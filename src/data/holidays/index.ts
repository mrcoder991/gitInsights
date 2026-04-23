// Bundled holiday catalogues. Stored as static JSON under
// `src/data/holidays/{REGION}.json` per spec §6 Public Holidays. Lazy-loaded
// at runtime so we only ship the byte cost of the regions the user picked.
//
// Phase 7 wires a yearly GitHub Actions cron that regenerates these JSONs
// from `nager/Nager.Date`. The runtime loader doesn't care about the source.

export type HolidayEntry = {
  date: string;
  name: string;
  regional?: boolean;
};

export type HolidayRegion = {
  code: string;
  label: string;
  flag: string;
  loader: () => Promise<HolidayEntry[]>;
};

const KNOWN_REGIONS: Record<string, HolidayRegion> = {
  US: {
    code: 'US',
    label: 'United States',
    flag: 'US',
    loader: async () => (await import('./US.json')).default as HolidayEntry[],
  },
  IN: {
    code: 'IN',
    label: 'India',
    flag: 'IN',
    loader: async () => (await import('./IN.json')).default as HolidayEntry[],
  },
  'GB-ENG': {
    code: 'GB-ENG',
    label: 'United Kingdom — England & Wales',
    flag: 'GB',
    loader: async () => (await import('./GB-ENG.json')).default as HolidayEntry[],
  },
};

export const SUPPORTED_HOLIDAY_REGIONS: ReadonlyArray<Pick<HolidayRegion, 'code' | 'label'>> =
  Object.values(KNOWN_REGIONS).map((r) => ({ code: r.code, label: r.label }));

export function isSupportedRegion(code: string): boolean {
  return code in KNOWN_REGIONS;
}

export async function loadHolidayDates(regions: string[]): Promise<HolidayEntry[]> {
  const supported = regions.filter(isSupportedRegion);
  const lists = await Promise.all(supported.map((c) => KNOWN_REGIONS[c]!.loader()));
  return lists.flat();
}

export type HolidayLookup = Map<string, HolidayEntry[]>;

export function indexHolidays(entries: HolidayEntry[]): HolidayLookup {
  const map: HolidayLookup = new Map();
  for (const entry of entries) {
    const existing = map.get(entry.date);
    if (existing) existing.push(entry);
    else map.set(entry.date, [entry]);
  }
  return map;
}
