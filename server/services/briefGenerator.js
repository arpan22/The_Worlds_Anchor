/**
 * Brief Generator — Country news digest via NVIDIA Nemotron
 *
 * Orchestrates the full background pipeline when a country is selected:
 *   1. Fetch articles (or use provided)
 *   2. Deduplicate
 *   3. Chunk for RAG
 *   4. Build vector index (embeddings)
 *   5. Generate country brief via Nemotron
 *   6. Update session to "ready"
 */
import { fetchCountryEvents } from './gdeltService.js';
import {
  deduplicateArticles,
  chunkArticles,
  buildVectorIndex,
} from './ragPipeline.js';
import { updateSession } from './sessionManager.js';
import {
  BRIEF_SYSTEM_PROMPT,
  buildBriefUserPrompt,
} from '../prompts/templates.js';

/**
 * Run the full background pipeline for a session.
 * This is called asynchronously — the API returns the sessionId immediately.
 *
 * @param {object} session       — Session object from sessionManager
 * @param {import('./NemotronClient.js').NemotronClient} nemotron
 */
export async function runBriefPipeline(session, nemotron) {
  const { sessionId, countryCode, countryName } = session;

  try {
    // ── Step 1: Fetch articles ────────────────────────────
    console.log(`[BriefGen] ${sessionId} — Fetching articles for ${countryName}`);

    const newsResult = await fetchCountryEvents(countryCode, countryName, {
      dateRange: '3d',
      maxRecords: 30,
    });

    if (newsResult.error && newsResult.articles.length === 0) {
      updateSession(sessionId, {
        status: 'error',
        error: `Failed to fetch events: ${newsResult.error}`,
      });
      return;
    }

    const rawArticles = newsResult.articles;
    updateSession(sessionId, { articles: rawArticles });
    console.log(`[BriefGen] ${sessionId} — Fetched ${rawArticles.length} articles`);

    // ── Step 2: Deduplicate ───────────────────────────────
    const dedupedArticles = deduplicateArticles(rawArticles);
    console.log(
      `[BriefGen] ${sessionId} — Deduped: ${rawArticles.length} → ${dedupedArticles.length}`
    );

    // ── Step 3: Chunk ─────────────────────────────────────
    const chunks = chunkArticles(dedupedArticles);
    console.log(`[BriefGen] ${sessionId} — Created ${chunks.length} chunks`);

    // ── Step 4: Build vector index (embeddings) ──────────
    const vectorIndex = await buildVectorIndex(chunks, nemotron);
    updateSession(sessionId, { vectorIndex });
    console.log(`[BriefGen] ${sessionId} — Vector index mode: ${vectorIndex.mode}`);

    // ── Step 5: Generate brief via Nemotron ───────────────
    console.log(`[BriefGen] ${sessionId} — Generating Nemotron brief...`);

    const briefArticles = dedupedArticles.slice(0, 20); // Use top 20 for brief prompt
    const messages = [
      { role: 'system', content: BRIEF_SYSTEM_PROMPT },
      { role: 'user', content: buildBriefUserPrompt(countryName, briefArticles) },
    ];

    const rawReply = await nemotron.chatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 3000,
      topP: 0.9,
    });

    // Parse the JSON response from Nemotron
    const brief = parseBriefResponse(rawReply);

    // ── Step 6: Mark session ready ────────────────────────
    updateSession(sessionId, {
      status: 'ready',
      brief,
      articles: dedupedArticles,
    });

    console.log(`[BriefGen] ${sessionId} — Brief ready!`);
  } catch (err) {
    console.error(`[BriefGen] ${sessionId} — Pipeline error:`, err.message);
    updateSession(sessionId, {
      status: 'error',
      error: `Brief generation failed: ${err.message}`,
    });
  }
}

/**
 * Parse Nemotron's JSON response for the brief.
 * Handles cases where the model wraps JSON in markdown code fences.
 */
function parseBriefResponse(raw) {
  let cleaned = raw.trim();

  // Strip markdown JSON fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
      narrative: typeof parsed.narrative === 'string' ? parsed.narrative : '',
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    };
  } catch {
    // If JSON parsing fails, create a simple brief from the raw text
    console.warn('[BriefGen] Failed to parse Nemotron JSON, using raw text fallback.');
    return {
      bullets: ['Brief generation completed but response format was unexpected.'],
      narrative: cleaned,
      topics: [],
    };
  }
}
