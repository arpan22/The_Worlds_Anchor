#!/usr/bin/env node
import fs from 'node:fs/promises';
import { SECONDARY_SPORTS_BY_COUNTRY_CODE } from '../data/secondarySportsDataset.js';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const OUT = process.env.OUT || 'secondary-coverage-report.csv';

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function fetchSecondary(countryCode, countryName) {
  const params = new URLSearchParams({
    country: countryCode,
    countryName,
    slot: 'secondary',
  });
  const res = await fetch(`${API_BASE}/api/sports-table?${params.toString()}`);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

async function main() {
  const rows = [
    ['countryCode', 'countryName', 'sheetSport', 'sheetLeague', 'status', 'providerLeague', 'teamCount', 'error'],
  ];

  const entries = Object.entries(SECONDARY_SPORTS_BY_COUNTRY_CODE).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [countryCode, rec] of entries) {
    const countryName = rec.country;
    const result = await fetchSecondary(countryCode, countryName);
    const teamCount = Array.isArray(result?.data?.table) ? result.data.table.length : 0;
    const providerLeague = result?.data?.league?.name || '';
    const error = result?.data?.error || (!result.ok ? `HTTP ${result.status}` : '');
    const status = teamCount > 0 ? 'ok' : 'missing';

    rows.push([
      countryCode,
      countryName,
      rec.sport || '',
      rec.league || '',
      status,
      providerLeague,
      String(teamCount),
      error,
    ]);
  }

  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
  await fs.writeFile(OUT, csv, 'utf8');
  const okCount = rows.slice(1).filter((r) => r[4] === 'ok').length;
  const total = rows.length - 1;
  console.log(`Wrote ${OUT} (${okCount}/${total} with teams)`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

