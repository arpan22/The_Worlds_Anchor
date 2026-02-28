/**
 * ACLED Frontend API Client
 *
 * Calls our Express backend routes, which in turn call the ACLED API securely
 * (keeping the API key server-side only).
 *
 * Base URL: /api/acled/*  (proxied by Vite to localhost:3001 in dev)
 */

const BASE = '/api/acled';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error || `ACLED API error: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Fetch ACLED events via our backend proxy.
 *
 * @param {object} params
 * @param {string} params.country       Full ACLED country name, e.g. "Ukraine"
 * @param {string} params.start_date    "YYYY-MM-DD"
 * @param {string} params.end_date      "YYYY-MM-DD"
 * @param {string} [params.event_type]  Filter by ACLED event type
 * @param {string} [params.actor]       Actor name substring
 * @param {string} [params.admin1]      Admin region filter
 * @param {number} [params.fatalities_min] Minimum fatalities
 *
 * @returns {Promise<{
 *   events: object[],
 *   total: number,
 *   cached: boolean,
 *   aggregates: { timeline: object[], typeBreakdown: object[], topActors: object[] },
 *   attribution: string
 * }>}
 */
export async function fetchAcledEvents({
  country,
  start_date,
  end_date,
  event_type = '',
  actor = '',
  admin1 = '',
  fatalities_min,
}) {
  const params = new URLSearchParams({ start_date, end_date });
  if (country) params.append('country', country);
  if (event_type) params.append('event_type', event_type);
  if (actor) params.append('actor', actor);
  if (admin1) params.append('admin1', admin1);
  if (fatalities_min != null) params.append('fatalities_min', String(fatalities_min));

  return apiFetch(`/events?${params}`);
}

/**
 * Fetch the ACLED event type taxonomy (for filter dropdowns).
 * @returns {Promise<{ types: { value: string, label: string }[] }>}
 */
export async function fetchEventTypes() {
  return apiFetch('/types');
}
