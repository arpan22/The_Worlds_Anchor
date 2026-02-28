const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `API error: ${res.status}`);
  }

  return data;
}

export async function getGroqStatus() {
  return apiFetch('/groq/status');
}

export async function sendGroqMessage(messages, newsBriefing = '') {
  return apiFetch('/groq/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, newsBriefing }),
  });
}
