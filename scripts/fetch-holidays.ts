import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build-time ingestion script for `src/data/holidays/{REGION}.json`. Sources
// from the open-source `nager/Nager.Date` API (https://date.nager.at), which
// is permissively licensed.
//
// Idempotent: running it multiple times produces the same files for the same
// inputs. Output is committed; Phase 7 wires this to a yearly GitHub Actions
// cron that re-runs the script and opens a PR with the refreshed datasets.
//
// Usage:
//   npx tsx scripts/fetch-holidays.ts            # default regions, current ±1 year
//   npx tsx scripts/fetch-holidays.ts US,IN      # explicit region list

type NagerHoliday = {
  date: string;
  name: string;
  localName?: string;
  countryCode: string;
  global?: boolean;
  counties?: string[] | null;
};

type HolidayEntry = {
  date: string;
  name: string;
  regional?: boolean;
};

const DEFAULT_REGIONS = ['US', 'IN', 'GB-ENG'];
const NAGER_BASE = 'https://date.nager.at/api/v3/PublicHolidays';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, '../src/data/holidays');

function targetYears(now = new Date()): number[] {
  const y = now.getFullYear();
  return [y - 1, y, y + 1];
}

function nagerCountry(region: string): { country: string; subdivision?: string } {
  if (region.includes('-')) {
    const [country, sub] = region.split('-');
    return { country: country!, subdivision: sub };
  }
  return { country: region };
}

async function fetchYear(region: string, year: number): Promise<NagerHoliday[]> {
  const { country, subdivision } = nagerCountry(region);
  const res = await fetch(`${NAGER_BASE}/${year}/${country}`);
  if (!res.ok) {
    throw new Error(`Nager.Date returned ${res.status} for ${country} ${year}`);
  }
  const all = (await res.json()) as NagerHoliday[];
  if (!subdivision) return all.filter((h) => h.global !== false);
  const tag = `${country}-${subdivision}`;
  return all.filter(
    (h) => h.global || (h.counties && h.counties.includes(tag)),
  );
}

function toEntries(items: NagerHoliday[]): HolidayEntry[] {
  return items
    .map((item) => ({
      date: item.date,
      name: item.name,
      ...(item.global === false ? { regional: true } : {}),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

async function writeRegion(region: string, entries: HolidayEntry[]): Promise<void> {
  const filePath = resolve(OUT_DIR, `${region}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(entries, null, 2)}\n`);
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  const regions = arg ? arg.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_REGIONS;
  const years = targetYears();

  for (const region of regions) {
    console.log(`fetching ${region} for ${years.join(', ')}...`);
    const all: NagerHoliday[] = [];
    for (const year of years) {
      const items = await fetchYear(region, year);
      all.push(...items);
    }
    const entries = toEntries(all);
    await writeRegion(region, entries);
    console.log(`  wrote ${entries.length} entries to src/data/holidays/${region}.json`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
