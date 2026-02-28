/**
 * Nemotron Prompt Templates
 *
 * All prompts used with NVIDIA Nemotron for:
 *   1. Country Brief generation (summarization)
 *   2. RAG-grounded chat (news sources only)
 *   3. Augmented chat (news + web sources via Gemini fallback)
 *   4. Condensed briefing fallback
 *
 * These are sent to Nemotron via the NVIDIA NIM chat completions API.
 * Nemotron is the ONLY model that produces final answers.
 */

// ──────────────────────────────────────────────
// 1. COUNTRY BRIEF — Nemotron System Prompt
// ──────────────────────────────────────────────
export const BRIEF_SYSTEM_PROMPT = `You are a senior news analyst. You will receive a batch of recent news articles about a specific country. Your job is to produce a structured country news brief.

OUTPUT FORMAT (respond with valid JSON only, no markdown fences):
{
  "bullets": [
    "Bullet 1: concise 'What happened' point",
    "Bullet 2: ...",
    ...up to 10 bullets
  ],
  "narrative": "A 3–5 paragraph narrative summary that ties the major stories together, providing context and significance. Use clear, journalistic prose.",
  "topics": [
    {
      "name": "Topic cluster name",
      "description": "1–2 sentence description of this topic cluster"
    },
    ...3 to 5 topic clusters
  ]
}

RULES:
- Produce exactly 10 bullet points (or fewer if there are fewer than 10 distinct events).
- The narrative should synthesize themes, not just repeat bullets.
- Topic clusters should group related stories.
- Stay strictly grounded in the provided articles. Do not invent facts.
- If articles are sparse, say so honestly in the narrative.
- Respond ONLY with the JSON object. No extra text.`;

// ──────────────────────────────────────────────
// 1b. COUNTRY BRIEF — Nemotron User Prompt
// ──────────────────────────────────────────────
export function buildBriefUserPrompt(countryName, articles) {
  const articleTexts = articles
    .map((a, i) => {
      const date = a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 10) : 'unknown';
      return `[${i + 1}] "${a.title}" — ${a.source} (${date})\n${a.description || ''}`;
    })
    .join('\n\n');

  return `Country: ${countryName}
Number of articles: ${articles.length}

ARTICLES:
${articleTexts}

Produce the country news brief as specified.`;
}

// ──────────────────────────────────────────────
// 2. RAG CHAT (NEWS ONLY) — Nemotron System Prompt
// ──────────────────────────────────────────────
export const CHAT_SYSTEM_PROMPT = `You are a helpful news assistant. You answer user questions about a country's current news.

You will be given CONTEXT from retrieved news article chunks. Your answers MUST be grounded in these chunks.

RULES:
- Only use information present in the provided CONTEXT.
- Cite sources by name in parentheses, like: (Source Name).
- If the context does not contain enough information to answer, say so in one sentence and stop.
- Be concise. 2-4 sentences max. Do NOT write long responses.
- Do NOT hallucinate or speculate beyond what the articles state.

STRICT OUTPUT RULES — VIOLATION MEANS FAILURE:
- Write ONLY your answer. Nothing else.
- Do NOT add any section headers or labels (no "Answer:", "Summary:", "Suggestions:", "Note:", "Limitation:", "Example:", etc).
- Do NOT add suggestions, follow-up questions, tips, examples, or disclaimers after your answer.
- Do NOT add numbered steps for the user to take.
- Do NOT use markdown (no **, ##, ---, backticks, tables).
- Your response must be a single short paragraph or at most two short paragraphs. That's it. Stop after answering.`;

// ──────────────────────────────────────────────
// 2b. RAG CHAT (NEWS ONLY) — Nemotron User Prompt
// ──────────────────────────────────────────────
export function buildChatUserPrompt(countryName, question, contextChunks) {
  const contextText = contextChunks
    .map((chunk, i) => {
      return `--- Chunk ${i + 1} [${chunk.source} | ${chunk.title}] (${chunk.url}) ---\n${chunk.text}`;
    })
    .join('\n\n');

  return `Country: ${countryName}

CONTEXT (retrieved article chunks):
${contextText}

USER QUESTION: ${question}`;
}

// ──────────────────────────────────────────────
// 3. AUGMENTED CHAT (NEWS + WEB) — Nemotron System Prompt
//    Used when Gemini provides supplementary web context.
//    Gemini output has been compressed into short factual snippets.
//    Nemotron remains the final reasoning & answer model.
// ──────────────────────────────────────────────
export const AUGMENTED_CHAT_SYSTEM_PROMPT = `You are a helpful news assistant. You answer user questions about a country's current events.

You have TWO types of context:
1. NEWS SOURCES — article chunks from recent news (primary, preferred)
2. WEB SOURCES — supplementary snippets from web search (secondary, fills gaps)

RULES:
- Prefer NEWS SOURCES when they contain the answer.
- Use WEB SOURCES to fill gaps that news articles don't cover.
- Cite news sources as: (Source Name). Cite web sources as: (Web: Title).
- Do NOT hallucinate or speculate beyond the provided context.
- Be concise. 2-4 sentences max. Do NOT write long responses.

STRICT OUTPUT RULES — VIOLATION MEANS FAILURE:
- Write ONLY your answer. Nothing else.
- Do NOT add any section headers or labels (no "Answer:", "Summary:", "Suggestions:", "Note:", "Limitation:", "Example:", etc).
- Do NOT add suggestions, follow-up questions, tips, examples, or disclaimers after your answer.
- Do NOT add numbered steps for the user to take.
- Do NOT use markdown (no **, ##, ---, backticks, tables).
- Your response must be a single short paragraph or at most two short paragraphs. That's it. Stop after answering.`;

// ──────────────────────────────────────────────
// 3b. AUGMENTED CHAT — Nemotron User Prompt
// ──────────────────────────────────────────────
export function buildAugmentedChatUserPrompt(countryName, question, newsChunks, webSnippet, webSources) {
  const newsContext = newsChunks
    .map((chunk, i) => {
      return `--- News ${i + 1} [${chunk.source} | ${chunk.title}] (${chunk.url}) ---\n${chunk.text}`;
    })
    .join('\n\n');

  const webSourceList = webSources
    .map((s, i) => `  [Web ${i + 1}] ${s.title} — ${s.url}`)
    .join('\n');

  return `Country: ${countryName}

NEWS SOURCES (retrieved article chunks):
${newsContext || '(No relevant news chunks found)'}

WEB SOURCES (supplementary, from web search):
${webSnippet || '(No web sources available)'}

Web source references:
${webSourceList || '(None)'}

USER QUESTION: ${question}`;
}

// ──────────────────────────────────────────────
// 4. Condensed Briefing Fallback Prompt
//    Used when embeddings are unavailable.
// ──────────────────────────────────────────────
export const FALLBACK_CHAT_SYSTEM_PROMPT = `You are a helpful news assistant. You answer questions about a country's current news using the provided briefing and article list.

RULES:
- Only use information present in the provided briefing and article list.
- Cite sources by name in parentheses: (Source Name).
- If the information is not available, say so in one sentence and stop.
- Be concise. 2-4 sentences max. Do NOT write long responses.

STRICT OUTPUT RULES — VIOLATION MEANS FAILURE:
- Write ONLY your answer. Nothing else.
- Do NOT add any section headers or labels (no "Answer:", "Summary:", "Suggestions:", "Note:", "Limitation:", "Example:", etc).
- Do NOT add suggestions, follow-up questions, tips, examples, or disclaimers after your answer.
- Do NOT use markdown (no **, ##, ---, backticks, tables).
- Your response must be a single short paragraph or at most two short paragraphs. That's it. Stop after answering.`;

// ──────────────────────────────────────────────
// 5. GRAPH GENERATION — Nemotron System Prompt
// ──────────────────────────────────────────────
export const GRAPH_SYSTEM_PROMPT = `You are a data analyst. You will receive a country news brief and a list of article titles. Your task is to produce a bar chart dataset summarizing the news landscape.

OUTPUT FORMAT (respond with valid JSON only, no markdown fences):
{
  "type": "bar",
  "title": "Short descriptive chart title",
  "xAxisLabel": "Category",
  "yAxisLabel": "Article Count",
  "data": [
    { "name": "Category Name", "value": number, "fill": "#hexcolor" }
  ]
}

RULES:
- Produce 5–8 data points representing topic/event-type frequency.
- Count how many articles fall into each category (Politics, Economy, Military, Diplomacy, Environment, Society, General).
- Use distinct hex colors for each bar (use: #2a788b, #f07f16, #76b900, #e05252, #9b59b6, #1abc9c, #f39c12).
- "value" must be a positive integer.
- Respond ONLY with the JSON object. No extra text.`;

export function buildGraphUserPrompt(brief, articles) {
  const bulletText = (brief?.bullets || []).slice(0, 8).map(b => `• ${b}`).join('\n');
  const articleTitles = articles.slice(0, 30).map((a, i) => `[${i + 1}] ${a.title} (${a.eventType || 'General'})`).join('\n');
  return `BRIEF SUMMARY:\n${bulletText || '(not available)'}\n\nARTICLE TITLES WITH EVENT TYPES:\n${articleTitles}\n\nProduce the bar chart dataset as specified.`;
}

// ──────────────────────────────────────────────
// 6. TIMELINE EXTRACTION — Nemotron System Prompt
// ──────────────────────────────────────────────
export const TIMELINE_SYSTEM_PROMPT = `You are a news historian. You will receive a list of news article titles with dates. Extract the most significant events and arrange them into a chronological timeline.

OUTPUT FORMAT (respond with valid JSON only, no markdown fences):
{
  "title": "Short descriptive timeline title",
  "events": [
    {
      "date": "YYYY-MM-DD",
      "title": "Short event headline (max 10 words)",
      "description": "1-2 sentence factual description of what happened.",
      "tone": "positive" | "negative" | "neutral"
    }
  ]
}

RULES:
- Include 5–12 events, ordered from oldest to newest.
- Use only events that have a clear date from the article metadata.
- Be strictly factual. Do not speculate or invent events.
- "tone" must be exactly one of: "positive", "negative", or "neutral".
- Respond ONLY with the JSON object. No extra text.`;

export function buildTimelineUserPrompt(articles) {
  const articleList = articles
    .slice(0, 30)
    .map((a, i) => {
      const date = a.publishedAt ? a.publishedAt.slice(0, 10) : 'unknown';
      return `[${i + 1}] (${date}) ${a.title}`;
    })
    .join('\n');
  return `ARTICLE LIST (date + title):\n${articleList}\n\nExtract and produce the chronological timeline as specified.`;
}

export function buildFallbackChatUserPrompt(countryName, question, brief, articles) {
  const articleList = articles
    .slice(0, 20)
    .map((a, i) => `[${i + 1}] "${a.title}" — ${a.source} | ${a.url}\n${a.description || ''}`)
    .join('\n');

  return `Country: ${countryName}

BRIEFING:
Bullets:
${(brief.bullets || []).map(b => `• ${b}`).join('\n')}

Narrative:
${brief.narrative || 'Not available.'}

ARTICLE LIST:
${articleList}

USER QUESTION: ${question}`;
}
