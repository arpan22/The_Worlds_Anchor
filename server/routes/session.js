/**
 * Session & Chat Routes
 *
 * POST   /api/country-session              — Create session, start Nemotron pipeline
 * GET    /api/country-session/:id/status    — Poll for brief readiness
 */
import { Router } from 'express';
import {
  createSession,
  getSession,
  findFreshSession,
  updateSession,
} from '../services/sessionManager.js';
import { runBriefPipeline } from '../services/briefGenerator.js';
import {
  GRAPH_SYSTEM_PROMPT,
  buildGraphUserPrompt,
  TIMELINE_SYSTEM_PROMPT,
  buildTimelineUserPrompt,
} from '../prompts/templates.js';

const router = Router();

// ──────────────────────────────────────────────
// POST /api/country-session
// ──────────────────────────────────────────────
router.post('/country-session', async (req, res) => {
  const { countryCode, countryName } = req.body;

  if (!countryCode || !countryName) {
    return res.status(400).json({
      error: 'Both "countryCode" and "countryName" are required.',
    });
  }

  const existing = findFreshSession(countryCode);
  if (existing) {
    return res.json({
      sessionId: existing.sessionId,
      status: existing.status,
      cached: true,
    });
  }

  const session = createSession(countryCode, countryName);

  const nemotron = req.app.locals.nemotron;
  runBriefPipeline(session, nemotron).catch((err) => {
    console.error(`[Session Route] Pipeline error for ${session.sessionId}:`, err.message);
    updateSession(session.sessionId, { status: 'error', error: err.message });
  });

  return res.status(201).json({
    sessionId: session.sessionId,
    status: 'building',
    cached: false,
  });
});

// ──────────────────────────────────────────────
// GET /api/country-session/:sessionId/status
// ──────────────────────────────────────────────
router.get('/country-session/:sessionId/status', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }

  const response = {
    sessionId: session.sessionId,
    status: session.status,
    countryCode: session.countryCode,
    countryName: session.countryName,
    articleCount: session.articles.length,
  };

  if (session.status === 'ready') response.brief = session.brief;
  if (session.status === 'error') response.error = session.error;

  return res.json(response);
});

// ──────────────────────────────────────────────
// POST /api/country-session/:sessionId/graph
// ──────────────────────────────────────────────
router.post('/country-session/:sessionId/graph', async (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found or expired.' });
  if (session.status !== 'ready') {
    return res.status(409).json({ error: 'Brief not ready yet.', status: session.status });
  }

  const nemotron = req.app.locals.nemotron;
  try {
    const raw = await nemotron.chatCompletion([
      { role: 'system', content: GRAPH_SYSTEM_PROMPT },
      { role: 'user', content: buildGraphUserPrompt(session.brief, session.articles, session.countryName) },
    ], { temperature: 0.2, maxTokens: 600, topP: 0.9 });

    const graphData = parseJsonResponse(raw);
    return res.json({ graphData });
  } catch (err) {
    console.error('[Graph] Error:', err.message);
    return res.status(500).json({ error: `Graph generation failed: ${err.message}` });
  }
});

// ──────────────────────────────────────────────
// POST /api/country-session/:sessionId/timeline
// ──────────────────────────────────────────────
router.post('/country-session/:sessionId/timeline', async (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found or expired.' });
  if (session.status !== 'ready') {
    return res.status(409).json({ error: 'Brief not ready yet.', status: session.status });
  }

  const nemotron = req.app.locals.nemotron;
  try {
    const raw = await nemotron.chatCompletion([
      { role: 'system', content: TIMELINE_SYSTEM_PROMPT },
      { role: 'user', content: buildTimelineUserPrompt(session.articles, session.countryName) },
    ], { temperature: 0.2, maxTokens: 1200, topP: 0.9 });

    const timelineData = parseJsonResponse(raw);
    return res.json({ timelineData });
  } catch (err) {
    console.error('[Timeline] Error:', err.message);
    return res.status(500).json({ error: `Timeline generation failed: ${err.message}` });
  }
});

export default router;

// ─── Helpers ───────────────────────────────────────────────

/** Strip markdown and unwanted meta-sections from Nemotron output */
function stripMarkdown(text) {
  let cleaned = text
    // Remove code fences
    .replace(/```[\s\S]*?```/g, '')
    // Remove headers (### Header)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic (**text**, *text*, __text__, _text_)
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Remove markdown links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove markdown table formatting
    .replace(/^\|.*\|$/gm, (line) => {
      if (/^\|[\s:|-]+\|$/.test(line)) return '';
      return line.replace(/^\||\|$/g, '').replace(/\|/g, ' — ').trim();
    })
    // Remove bullet markers (- item, * item) but keep the text
    .replace(/^[\s]*[-*+]\s+/gm, '- ')
    // Collapse multiple blank lines into one
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Remove unwanted trailing sections that Nemotron adds despite instructions.
  // These are labeled sections like "Suggestions for ...", "Example of ...",
  // "Current Limitation ...", "Note:", "Important:", "Next Steps:", etc.
  const cutPatterns = [
    /\n\s*Suggestion[s]?\s*(for|to|on)\b[\s\S]*/i,
    /\n\s*Example[s]?\s*(of|for|:)\b[\s\S]*/i,
    /\n\s*Current Limitation[\s\S]*/i,
    /\n\s*Limitation[s]?\s*Reminder[\s\S]*/i,
    /\n\s*Note:\s[\s\S]*/i,
    /\n\s*Important:\s[\s\S]*/i,
    /\n\s*Next Steps?[\s\S]*/i,
    /\n\s*Further Inquiry[\s\S]*/i,
    /\n\s*How to Refine[\s\S]*/i,
    /\n\s*Required for Above[\s\S]*/i,
    /\n\s*Refined Question[\s\S]*/i,
    /\n\s*Disclaimer[\s\S]*/i,
    /\n\s*Additional (?:Notes?|Info|Context)[\s\S]*/i,
    /\n\s*Key Takeaway[s]?[\s\S]*/i,
    /\n\s*In Summary[\s\S]*/i,
    /\n\s*To Summarize[\s\S]*/i,
    /\n\s*TL;?DR[\s\S]*/i,
  ];

  for (const pat of cutPatterns) {
    cleaned = cleaned.replace(pat, '');
  }

  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

/** Parse JSON from Nemotron response, stripping markdown fences if present */
function parseJsonResponse(raw) {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  return JSON.parse(cleaned);
}
