/**
 * RAG Pipeline — Deduplication, Chunking, Embedding & Retrieval
 *
 * Implements a lightweight Retrieval-Augmented Generation pipeline:
 *   1. Deduplication   — Remove wire copies / syndicated duplicates
 *   2. Chunking        — Split articles into 300-800 token chunks
 *   3. Embedding       — NVIDIA NIM embeddings (with TF-IDF fallback)
 *   4. Vector index    — In-memory cosine similarity store
 *   5. Retrieval       — Top-K chunks with recency boost
 */
import { config } from '../config/index.js';

// ──────────────────────────────────────────────
// 1. DEDUPLICATION
// ──────────────────────────────────────────────

/**
 * Remove duplicate / near-duplicate articles (wire copies, syndicated).
 * Uses Jaccard similarity on title word sets.
 */
export function deduplicateArticles(articles) {
  const unique = [];
  const titleSets = [];

  for (const article of articles) {
    const words = tokenizeForDedup(article.title);
    const wordSet = new Set(words);

    let isDuplicate = false;
    for (const existing of titleSets) {
      if (jaccardSimilarity(wordSet, existing) > 0.6) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(article);
      titleSets.push(wordSet);
    }
  }

  return unique;
}

function tokenizeForDedup(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function jaccardSimilarity(setA, setB) {
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ──────────────────────────────────────────────
// 2. CHUNKING
// ──────────────────────────────────────────────

/**
 * Chunk articles into pieces of ~300-800 tokens.
 * Each chunk keeps metadata (source, title, url, publishedAt).
 *
 * Strategy: split by sentences, accumulate until target size is reached.
 */
export function chunkArticles(articles) {
  const chunks = [];
  const targetSize = config.ragChunkSize; // ~500 tokens
  const overlap = config.ragChunkOverlap;

  for (const article of articles) {
    const fullText = [article.title, article.description, article.content]
      .filter(Boolean)
      .join('. ');

    const sentences = splitIntoSentences(fullText);
    let buffer = [];
    let bufferTokenCount = 0;

    for (const sentence of sentences) {
      const sentenceTokens = estimateTokens(sentence);

      // If a single sentence exceeds target, emit it as its own chunk
      if (sentenceTokens > targetSize && buffer.length === 0) {
        chunks.push(makeChunk(sentence, article));
        continue;
      }

      // If adding this sentence would exceed target, emit current buffer
      if (bufferTokenCount + sentenceTokens > targetSize && buffer.length > 0) {
        chunks.push(makeChunk(buffer.join(' '), article));

        // Keep last sentence(s) as overlap for context continuity
        const overlapSentences = [];
        let overlapCount = 0;
        for (let i = buffer.length - 1; i >= 0; i--) {
          const t = estimateTokens(buffer[i]);
          if (overlapCount + t > overlap) break;
          overlapSentences.unshift(buffer[i]);
          overlapCount += t;
        }
        buffer = overlapSentences;
        bufferTokenCount = overlapCount;
      }

      buffer.push(sentence);
      bufferTokenCount += sentenceTokens;
    }

    // Emit remaining buffer
    if (buffer.length > 0) {
      chunks.push(makeChunk(buffer.join(' '), article));
    }
  }

  return chunks;
}

function makeChunk(text, article) {
  return {
    text,
    title: article.title,
    source: article.source,
    url: article.url,
    publishedAt: article.publishedAt,
    tokenCount: estimateTokens(text),
  };
}

function splitIntoSentences(text) {
  // Split on sentence boundaries while keeping the delimiter
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Rough token estimate: ~1 token per 4 characters (English average) */
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

// ──────────────────────────────────────────────
// 3. VECTOR INDEX (in-memory)
// ──────────────────────────────────────────────

/**
 * Build a vector index from chunks using NVIDIA NIM embeddings.
 * Falls back to TF-IDF if embedding API is unavailable.
 *
 * @param {object[]} chunks - Array of chunk objects from chunkArticles()
 * @param {import('./NemotronClient.js').NemotronClient} nemotron
 * @returns {Promise<object>} Vector index object
 */
export async function buildVectorIndex(chunks, nemotron) {
  const index = {
    chunks,
    embeddings: null,
    tfidf: null,
    mode: 'none', // 'nvidia' | 'tfidf' | 'none'
  };

  if (chunks.length === 0) return index;

  // Attempt NVIDIA NIM embeddings
  try {
    const texts = chunks.map((c) => c.text);

    // Batch in groups of 50 to stay within API limits
    const batchSize = 50;
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await nemotron.generateEmbeddings(batch);
      allEmbeddings.push(...embeddings);
    }

    index.embeddings = allEmbeddings;
    index.mode = 'nvidia';
    console.log(`[RAG] Built NVIDIA vector index: ${chunks.length} chunks`);
    return index;
  } catch (err) {
    console.warn(`[RAG] NVIDIA embeddings failed, falling back to TF-IDF: ${err.message}`);
  }

  // Fallback: TF-IDF vectors
  try {
    index.tfidf = buildTfIdf(chunks.map((c) => c.text));
    index.mode = 'tfidf';
    console.log(`[RAG] Built TF-IDF fallback index: ${chunks.length} chunks`);
  } catch (err) {
    console.error(`[RAG] TF-IDF fallback also failed: ${err.message}`);
    index.mode = 'none';
  }

  return index;
}

// ──────────────────────────────────────────────
// 4. RETRIEVAL
// ──────────────────────────────────────────────

/**
 * Retrieve the top-K most relevant chunks for a query.
 * Applies a recency boost (newer articles score higher).
 *
 * @param {string} query
 * @param {object} vectorIndex - From buildVectorIndex()
 * @param {import('./NemotronClient.js').NemotronClient} nemotron
 * @param {number} [topK]
 * @returns {Promise<object[]>} Top-K chunks with scores
 */
export async function retrieveChunks(query, vectorIndex, nemotron, topK) {
  const k = topK || config.ragTopK;
  const { chunks } = vectorIndex;

  if (chunks.length === 0) return [];

  let scores;

  if (vectorIndex.mode === 'nvidia') {
    // Use NVIDIA NIM query embedding
    const queryEmb = await nemotron.generateQueryEmbedding(query);
    scores = vectorIndex.embeddings.map((emb) => cosineSimilarity(queryEmb, emb));
  } else if (vectorIndex.mode === 'tfidf') {
    // Use TF-IDF similarity
    scores = tfidfQuery(query, vectorIndex.tfidf);
  } else {
    // No index available — return first K chunks by recency
    return chunks
      .slice()
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, k);
  }

  // Apply recency boost: more recent articles get a boost
  const now = Date.now();
  const boostedScores = scores.map((score, i) => {
    const age = now - new Date(chunks[i].publishedAt).getTime();
    const ageHours = age / 3_600_000;
    // Decay: articles from 72h ago get 0.8x, 0h gets 1.0x
    const recencyMultiplier = Math.max(0.6, 1 - ageHours / 360);
    return score * recencyMultiplier;
  });

  // Sort by boosted score, return top K
  const ranked = boostedScores
    .map((score, i) => ({ ...chunks[i], score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return ranked;
}

// ──────────────────────────────────────────────
// 5. MATH UTILITIES
// ──────────────────────────────────────────────

function cosineSimilarity(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ──────────────────────────────────────────────
// 6. TF-IDF FALLBACK
// ──────────────────────────────────────────────

function buildTfIdf(documents) {
  const vocab = new Map();
  const df = new Map();
  const docCount = documents.length;

  // Build vocabulary and document frequencies
  const tokenizedDocs = documents.map((doc) => {
    const words = tfidfTokenize(doc);
    const unique = new Set(words);
    for (const w of unique) {
      df.set(w, (df.get(w) || 0) + 1);
    }
    return words;
  });

  // Assign indices to vocabulary
  let idx = 0;
  for (const word of df.keys()) {
    vocab.set(word, idx++);
  }

  // Compute IDF values
  const idf = new Float64Array(vocab.size);
  for (const [word, freq] of df) {
    idf[vocab.get(word)] = Math.log((docCount + 1) / (freq + 1)) + 1;
  }

  // Compute TF-IDF vectors for each document
  const vectors = tokenizedDocs.map((words) => {
    const tf = new Map();
    for (const w of words) {
      tf.set(w, (tf.get(w) || 0) + 1);
    }

    const vec = new Float64Array(vocab.size);
    for (const [word, count] of tf) {
      const i = vocab.get(word);
      if (i !== undefined) {
        vec[i] = (count / words.length) * idf[i];
      }
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    }

    return vec;
  });

  return { vocab, idf, vectors };
}

function tfidfQuery(query, tfidfIndex) {
  const words = tfidfTokenize(query);
  const { vocab, idf, vectors } = tfidfIndex;

  // Build query TF-IDF vector
  const tf = new Map();
  for (const w of words) tf.set(w, (tf.get(w) || 0) + 1);

  const qVec = new Float64Array(vocab.size);
  for (const [word, count] of tf) {
    const i = vocab.get(word);
    if (i !== undefined) {
      qVec[i] = (count / words.length) * idf[i];
    }
  }

  // L2 normalize query vector
  let norm = 0;
  for (let i = 0; i < qVec.length; i++) norm += qVec[i] * qVec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < qVec.length; i++) qVec[i] /= norm;
  }

  // Cosine similarity between query and each document
  return vectors.map((docVec) => {
    let dot = 0;
    for (let i = 0; i < qVec.length; i++) dot += qVec[i] * docVec[i];
    return dot;
  });
}

function tfidfTokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}
