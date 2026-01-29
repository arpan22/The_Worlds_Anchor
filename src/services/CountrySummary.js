export async function fetchCountrySummary(country) {
  const title = country?.properties?.name;
  if (!title) return null;

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const headers = { "Api-User-Agent": "CountryNewsTest/0.1 (caleb@example.com)" };

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const data = await res.json();
  return data.extract ?? null;
}
