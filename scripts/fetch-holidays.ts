import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Nager.Date for all ISO/region codes below, except IN (calendar-bharat + `indiaEventAllowed`).

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

/** Nager `PublicHolidays` country, or `CC-subdivision` when the API returns `counties: ['CC-XX', …]`. */
const DEFAULT_REGIONS = [
  'US',
  'CA-AB',
  'CA-BC',
  'CA-MB',
  'CA-NB',
  'CA-ON',
  'CA-QC',
  'CA-SK',
  'IN',
  'AR',
  'DE',
  'GB-ENG',
  'GB-SCT',
  'AU-TAS',
  'AU-VIC',
  'FR',
  'SV',
  'RO',
  'ES-MD',
  'ES-MC',
  'ES-CT',
];
const BHARAT_BASE = 'https://jayantur13.github.io/calendar-bharat/calendar';
const NAGER_BASE = 'https://date.nager.at/api/v3/PublicHolidays';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, '../src/data/holidays');

function targetYears(now = new Date()): number[] {
  const y = now.getFullYear();
  return [y - 1, y, y + 1];
}

function nagerCountry(region: string): { country: string; subdivision?: string } {
  const i = region.indexOf('-');
  if (i === -1) return { country: region };
  return { country: region.slice(0, i), subdivision: region.slice(i + 1) };
}

const BHARAT_MONTH: Record<string, string> = {
  January: '01',
  February: '02',
  March: '03',
  April: '04',
  May: '05',
  June: '06',
  July: '07',
  August: '08',
  September: '09',
  October: '10',
  November: '11',
  December: '12',
};

/** Calendar-bharat keys are plain calendar days in India; never use `toISOString()` (UTC shifts the date). */
function parseBharatDateKey(key: string): string | null {
  const m = key.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})/u);
  if (!m) return null;
  const mo = BHARAT_MONTH[m[1] ?? ''];
  if (!mo) return null;
  const d = m[2]!.padStart(2, '0');
  return `${m[3]}-${mo}-${d}`;
}

type BharatEvent = { date: string; event: string; type: string };

function bharatFlatten(yearNode: Record<string, unknown>): BharatEvent[] {
  const out: BharatEvent[] = [];
  for (const monthBlock of Object.values(yearNode)) {
    if (!monthBlock || typeof monthBlock !== 'object') continue;
    for (const [dateKey, raw] of Object.entries(monthBlock as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const day = raw as { event?: unknown; type?: unknown };
      if (typeof day.event !== 'string') continue;
      const typ = typeof day.type === 'string' ? day.type : '';
      const date = parseBharatDateKey(dateKey);
      if (!date) continue;
      out.push({ date, event: day.event, type: typ });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const INDIA_NAME_DENY = new RegExp(
  [
    'holika|holi dahan|dhanter|dhan$|holi ho',
    'gandhi puny|purnyat|punyatithi',
    'shaheed|subhas|bose|tagore',
    "bank'?s? holiday",
    'maha\\s*navami$',
    'guru (gobind|tegh)|chhath|bhai(ya)?\\s+dooj|jamat|eid-?e-?milad|eid-?e-?mil|hazarat|milad|prophet[\\s-]birth|birth[\\s-]of[\\s-]prophet',
    'gudi|onam|bihu|mahavir|rama?\\s*nav|ramakrishna|pongal(?!$)',
    'guru purn|loshar|ganga',
  ].join('|'),
  'iu',
);

/** Broad MNC / long gazetted-style names; pair with `INDIA_NAME_DENY` for non-gazetted noise. */
const INDIA_NAME_ALLOW = new RegExp(
  [
    'english new year',
    "^(new|english) year$",
    'republic day',
    'independence day',
    '^holi$',
    'good friday',
    'buddha purn|buddh(a)? jayanti',
    '\\bbakrid\\b|eid[\\s-]?(ul-?a[dz]h|al-?a[dz]h)|\\bqurbani?\\b',
    "eid\\s*(ul-?|al-?)?fitr|eid[\\s-]al[\\s-]fitr|eid[\\s-]ul[\\s-]fitr|\\bfitr\\b",
    '\\bmuharram\\b',
    'guru\\s*nanak',
    'maha[\\s-]*shivarat?ri',
    'janmasht',
    '^rakhi$|raksh(a)?\\s*bandh',
    'ganesh chatur',
    'gandhi jayanti',
    '(vijaya|vijay)[\\s-]*dash(ami|)',
    'dussehr|dashehr',
    'd[ií]wall?i(?! t)|(^| )diwal(?!a ter)',
    'merry christ|(^| )christ(?!opher)|christmas( day)?$',
    "international workers'|workers' day|labou?r( day)?$|^may day$",
  ].join('|'),
  'iu',
);

function indiaEventAllowed(e: BharatEvent): boolean {
  const t = e.event.trim();
  if (!t) return false;
  if (e.type === 'Astronomy Event') return false;

  if (e.type === 'Good to know') {
    return /international workers|workers' day|labou?r|may day/i.test(t) && !/cancer|yoga(?!\s*day)/iu.test(t);
  }
  if (e.type !== 'Government Holiday' && e.type !== 'Religional Festival' && e.type !== 'Regional Festival') {
    return false;
  }

  if (/(^| )di?wal/i.test(t) && /dhanter/iu.test(t)) return false;
  if (/gandhi/iu.test(t) && /puny/iu.test(t)) return false;
  if (!INDIA_NAME_ALLOW.test(t)) return false;
  if (INDIA_NAME_DENY.test(t)) return false;
  if (/^maha navami$/i.test(t)) return false;
  return true;
}

function bharatToEntry(row: BharatEvent): HolidayEntry {
  const name = row.event
    .replace(/\s*\*ISKCON\s*$/iu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  const r =
    row.type === 'Religional Festival' || row.type === 'Regional Festival' || row.type === 'Good to know';
  return { date: row.date, name, ...(r ? { regional: true } : {}) };
}

function mergeSameDate(a: readonly HolidayEntry[]): HolidayEntry[] {
  const m = new Map<string, HolidayEntry>();
  for (const e of a) {
    const ex = m.get(e.date);
    if (!ex) m.set(e.date, { ...e });
    else if (ex.name !== e.name) {
      m.set(e.date, {
        date: e.date,
        name: ex.name.includes(e.name) ? ex.name : e.name.includes(ex.name) ? e.name : `${ex.name} / ${e.name}`,
        ...((ex.regional || e.regional) && { regional: true }),
      });
    }
  }
  return [...m.values()].sort((x, y) => x.date.localeCompare(y.date));
}

async function bharatEventsForYear(year: number): Promise<BharatEvent[]> {
  const res = await fetch(`${BHARAT_BASE}/${year}.json`);
  if (!res.ok) {
    throw new Error(`calendar-bharat ${res.status} for ${year}`);
  }
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`calendar-bharat empty body for ${year}`);
  }
  let root: unknown;
  try {
    root = JSON.parse(text) as object;
  } catch {
    throw new Error(`calendar-bharat invalid JSON for ${year}`);
  }
  const yKey = String(year);
  const yVal =
    root && typeof root === 'object' && yKey in root
      ? (root as Record<string, unknown>)[yKey]
      : null;
  if (!yVal || typeof yVal !== 'object') {
    throw new Error(`calendar-bharat: missing "${yKey}" in file for ${year}`);
  }
  return bharatFlatten(yVal as Record<string, unknown>);
}

function indiaHolidaysFromBharat(b: readonly BharatEvent[]): HolidayEntry[] {
  const keep = b.filter((row) => indiaEventAllowed(row)).map(bharatToEntry);
  return mergeSameDate(keep);
}

async function fetchIndiaHolidays(years: number[]): Promise<HolidayEntry[]> {
  const all: HolidayEntry[] = [];
  for (const y of years) {
    const b = await bharatEventsForYear(y);
    all.push(...indiaHolidaysFromBharat(b));
  }
  return mergeSameDate(all);
}

async function fetchYearNager(region: string, year: number): Promise<NagerHoliday[]> {
  const { country, subdivision } = nagerCountry(region);
  const r = await fetch(`${NAGER_BASE}/${year}/${country}`);
  if (!r.ok) {
    throw new Error(`Nager.Date returned ${r.status} for ${country} ${year}`);
  }
  const text = await r.text();
  if (!text.trim()) {
    throw new Error(`Nager.Date empty body for ${country} ${year}`);
  }
  let all: NagerHoliday[];
  try {
    all = JSON.parse(text) as NagerHoliday[];
  } catch {
    throw new Error(`Nager.Date non-JSON for ${country} ${year}`);
  }
  if (!Array.isArray(all)) {
    throw new Error(`Nager.Date non-array for ${country} ${year}`);
  }
  if (!subdivision) return all.filter((h) => h.global !== false);
  const tag = `${country}-${subdivision}`;
  return all.filter(
    (h) => h.global || (h.counties && h.counties.includes(tag)),
  );
}

function toEntriesNager(items: NagerHoliday[]): HolidayEntry[] {
  return items
    .map((item) => ({
      date: item.date,
      name: item.name,
      ...(item.global === false ? { regional: true } : {}),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
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
    if (region === 'IN') {
      try {
        console.log(`fetching IN (bharat + name filter) for ${years.join(', ')}...`);
        const entries = await fetchIndiaHolidays(years);
        await writeRegion('IN', entries);
        console.log(`  wrote ${entries.length} entries to src/data/holidays/IN.json`);
      } catch (e) {
        console.error(`  skip IN: ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }
    try {
      console.log(`fetching ${region} (Nager) for ${years.join(', ')}...`);
      const all: NagerHoliday[] = [];
      for (const year of years) {
        all.push(...(await fetchYearNager(region, year)));
      }
      const entries = toEntriesNager(all);
      await writeRegion(region, entries);
      console.log(`  wrote ${entries.length} entries to src/data/holidays/${region}.json`);
    } catch (e) {
      console.error(`  skip ${region}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
