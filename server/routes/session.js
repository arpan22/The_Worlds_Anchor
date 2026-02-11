/**
 * Session & Chat Routes
 *
 * POST   /api/country-session              — Create session, start Nemotron pipeline
 * GET    /api/country-session/:id/status    — Poll for brief readiness
 * POST   /api/country-session/:id/chat      — RAG-grounded chat with decision flow
 *
 * DECISION FLOW (per chat request):
 *   1. Retrieve chunks via RAG → attempt Nemotron answer
 *   2. If confidence is low AND Gemini enabled:
 *      a. Call GeminiSearchClient (web-grounded search)
 *      b. Compress Gemini results into factual snippets
 *      c. Pass snippets + RAG chunks into Nemotron as augmented context
 *   3. Nemotron produces the FINAL response with citations
 *
 * Gemini NEVER replaces Nemotron for reasoning.
 */
import { Router } from 'express';
import {
  createSession,
  getSession,
  findFreshSession,
  updateSession,
  addChatMessage,
} from '../services/sessionManager.js';
import { runBriefPipeline } from '../services/briefGenerator.js';
import { retrieveChunks } from '../services/ragPipeline.js';
import { config } from '../config/index.js';
import {
  CHAT_SYSTEM_PROMPT,
  buildChatUserPrompt,
  AUGMENTED_CHAT_SYSTEM_PROMPT,
  buildAugmentedChatUserPrompt,
  FALLBACK_CHAT_SYSTEM_PROMPT,
  buildFallbackChatUserPrompt,
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
// POST /api/country-session/:sessionId/chat
//
// Decision flow:
//   1. RAG retrieval
//   2. Confidence check
//   3. Gemini fallback (if low confidence + enabled)
//   4. Nemotron final answer
// ──────────────────────────────────────────────
router.post('/country-session/:sessionId/chat', async (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }

  if (session.status === 'building') {
    return res.status(409).json({ error: 'Brief is still being generated.', status: 'building' });
  }

  const { message, settings = {} } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: '"message" is required.' });
  }

  // Merge client settings with server defaults
  const opts = {
    geminiEnabled: settings.geminiEnabled ?? config.defaults.geminiEnabled,
    geminiMaxInputTokens: settings.geminiMaxInputTokens ?? config.defaults.geminiMaxInputTokens,
    geminiMaxOutputTokens: settings.geminiMaxOutputTokens ?? config.defaults.geminiMaxOutputTokens,
    nemotronMaxContextTokens: settings.nemotronMaxContextTokens ?? config.defaults.nemotronMaxContextTokens,
  };

  const nemotron = req.app.locals.nemotron;
  const gemini = req.app.locals.gemini;

  try {
    addChatMessage(session.sessionId, 'user', message);

    let reply;
    let newsSources = [];
    let webSources = [];
    let sourceType = 'news_only'; // "news_only" | "augmented_with_web"

    // ── Step 1: RAG retrieval ──
    let topChunks = [];
    let avgScore = 0;

    if (session.vectorIndex && session.vectorIndex.mode !== 'none') {
      topChunks = await retrieveChunks(message, session.vectorIndex, nemotron);

      // Collect news sources
      const sourceMap = new Map();
      for (const chunk of topChunks) {
        if (!sourceMap.has(chunk.url)) {
          sourceMap.set(chunk.url, { title: chunk.title, source: chunk.source, url: chunk.url, type: 'news' });
        }
      }
      newsSources = [...sourceMap.values()];

      // Calculate average relevance score for confidence check
      if (topChunks.length > 0) {
        avgScore = topChunks.reduce((sum, c) => sum + (c.score || 0), 0) / topChunks.length;
      }
    }

    // ── Step 2: Always call Gemini for web-grounded context ──
    let webSnippetText = '';
    if (opts.geminiEnabled && gemini && gemini.isAvailable) {
      try {
        console.log(`[Chat] Calling Gemini for web context (avg=${avgScore.toFixed(3)}, chunks=${topChunks.length})...`);

        const geminiResult = await gemini.groundedSearch(message, session.countryName);

        webSnippetText = geminiResult.text || '';
        webSources = geminiResult.sources || [];
        sourceType = 'augmented_with_web';

        console.log(`[Chat] Gemini returned ${webSources.length} web sources`);
      } catch (geminiErr) {
        console.warn(`[Chat] Gemini call failed: ${geminiErr.message}`);
        sourceType = 'gemini_failed';
      }
    }

    // ── Step 4: Trim context to Nemotron token budget ──
    const trimmedChunks = trimChunksToTokenBudget(topChunks, opts.nemotronMaxContextTokens);

    // ── Step 5: Build Nemotron prompt & get final answer ──
    const chatMessages = [];
    const recentHistory = session.chatHistory.slice(-6);

    if (sourceType === 'augmented_with_web' && webSnippetText) {
      // Augmented path: news + web sources
      chatMessages.push({ role: 'system', content: AUGMENTED_CHAT_SYSTEM_PROMPT });
      for (const turn of recentHistory) {
        chatMessages.push({ role: turn.role, content: turn.content });
      }
      chatMessages.push({
        role: 'user',
        content: buildAugmentedChatUserPrompt(
          session.countryName, message, trimmedChunks, webSnippetText, webSources
        ),
      });
    } else if (trimmedChunks.length > 0) {
      // News-only path
      chatMessages.push({ role: 'system', content: CHAT_SYSTEM_PROMPT });
      for (const turn of recentHistory) {
        chatMessages.push({ role: turn.role, content: turn.content });
      }
      chatMessages.push({
        role: 'user',
        content: buildChatUserPrompt(session.countryName, message, trimmedChunks),
      });
    } else {
      // Fallback: condensed brief
      chatMessages.push({ role: 'system', content: FALLBACK_CHAT_SYSTEM_PROMPT });
      for (const turn of recentHistory) {
        chatMessages.push({ role: turn.role, content: turn.content });
      }
      chatMessages.push({
        role: 'user',
        content: buildFallbackChatUserPrompt(
          session.countryName, message,
          session.brief || { bullets: [], narrative: '' },
          session.articles
        ),
      });
      newsSources = session.articles.slice(0, 10).map((a) => ({
        title: a.title, source: a.source, url: a.url, type: 'news',
      }));
    }

    // ── SSE streaming response ──
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send sources/metadata immediately so the UI can render badges while streaming
    const meta = JSON.stringify({ sources: { news: newsSources, web: webSources }, sourceType });
    res.write(`event: meta\ndata: ${meta}\n\n`);

    const sseStream = await nemotron.chatCompletionStream(chatMessages, {
      temperature: 0.3,
      maxTokens: 500,
      topP: 0.8,
    });

    let fullReply = '';
    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of sseStream) {
      buffer += decoder.decode(chunk, { stream: true });

      // Process complete SSE lines from the buffer
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const payload = trimmed.slice(6);
        if (payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullReply += delta;
            res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    // Post-process and save
    reply = stripMarkdown(fullReply);
    addChatMessage(session.sessionId, 'assistant', reply);

    // Send the cleaned final reply so frontend can replace streamed text
    res.write(`event: done\ndata: ${JSON.stringify({ reply })}\n\n`);
    return res.end();
  } catch (err) {
    console.error(`[Chat] Error for session ${session.sessionId}:`, err.message);
    return res.status(500).json({ error: `Chat failed: ${err.message}` });
  }
});

export default router;

// ─── Helpers ───────────────────────────────────────────────

/** Trim chunks to fit within a token budget */
function trimChunksToTokenBudget(chunks, maxTokens) {
  let total = 0;
  const kept = [];
  for (const chunk of chunks) {
    const tokens = chunk.tokenCount || Math.ceil((chunk.text || '').length / 4);
    if (total + tokens > maxTokens) break;
    kept.push(chunk);
    total += tokens;
  }
  return kept;
}

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
