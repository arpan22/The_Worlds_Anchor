// Node 18+: fetch is built in

const TITLE = process.argv[2] ?? "Germany";
const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(TITLE)}`;

const headers = {
  // Browsers can’t set User-Agent directly; in Node you can, but Api-User-Agent is also fine.
  "Api-User-Agent": "CountryNewsTest/0.1 (caleb@example.com)"
};

const res = await fetch(url, { headers });
if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

const data = await res.json();
console.log(data.title);
console.log();
console.log(data.extract);
