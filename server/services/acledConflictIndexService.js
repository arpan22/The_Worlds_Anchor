import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKBOOK_PATH = resolve(__dirname, '../data/ACLED_Conflict_Index_2025.xlsx');

let _byCountry = null;

function normalizeCountryKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function loadOnce() {
  if (_byCountry) return;

  const wb = XLSX.readFile(WORKBOOK_PATH);
  const sheet = wb.Sheets.Results;
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  _byCountry = new Map();
  for (const row of rows) {
    const country = String(row.Country || '').trim();
    if (!country) continue;

    _byCountry.set(normalizeCountryKey(country), {
      country,
      level: row['Index Level'] || null,
      ranking: toInt(row['Index Ranking']),
      deadlinessRanking: toInt(row['Deadliness Ranking']),
      diffusionRanking: toInt(row['Diffusion Ranking']),
      dangerRanking: toInt(row['Danger Ranking']),
      fragmentationRanking: toInt(row['Fragmentation Ranking']),
      deadlinessValue: toNumber(row['Deadliness Value']),
      diffusionValue: toNumber(row['Diffusion Value']),
      dangerValue: toNumber(row['Danger Value']),
      fragmentationValue: toNumber(row['Fragmentation Value']),
    });
  }
}

function toInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getConflictIndex(country) {
  loadOnce();
  return _byCountry.get(normalizeCountryKey(country)) || null;
}
