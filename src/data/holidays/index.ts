// Bundled holiday catalogues. Stored as static JSON under
// `src/data/holidays/{REGION}.json` per spec §6 Public Holidays. Lazy-loaded
// at runtime so we only ship the byte cost of the regions the user picked.
//
// India: calendar-bharat + `indiaEventAllowed` in `scripts/fetch-holidays.ts`. Others: Nager.Date.

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

const holidayJsonLoaders = import.meta.glob<HolidayEntry[]>('./*.json', { import: 'default' });

function loaderFor(code: string): () => Promise<HolidayEntry[]> {
  const path = `./${code}.json`;
  const load = (holidayJsonLoaders as Record<string, () => Promise<HolidayEntry[]>>)[path];
  if (!load) {
    return async () => {
      throw new Error(`no bundled holidays for ${code} (${path})`);
    };
  }
  return load;
}

const REGION_LIST: Array<Pick<HolidayRegion, 'code' | 'label' | 'flag'>> = [
  { code: 'US', label: 'United States', flag: 'US' },
  { code: 'CA-AB', label: 'Canada — Alberta', flag: 'CA' },
  { code: 'CA-BC', label: 'Canada — British Columbia', flag: 'CA' },
  { code: 'CA-MB', label: 'Canada — Manitoba', flag: 'CA' },
  { code: 'CA-NB', label: 'Canada — New Brunswick', flag: 'CA' },
  { code: 'CA-ON', label: 'Canada — Ontario', flag: 'CA' },
  { code: 'CA-QC', label: 'Canada — Quebec', flag: 'CA' },
  { code: 'CA-SK', label: 'Canada — Saskatchewan', flag: 'CA' },
  { code: 'IN', label: 'India', flag: 'IN' },
  { code: 'AR', label: 'Argentina', flag: 'AR' },
  { code: 'DE', label: 'Germany', flag: 'DE' },
  { code: 'GB-ENG', label: 'United Kingdom — England & Wales', flag: 'GB' },
  { code: 'GB-SCT', label: 'United Kingdom — Scotland', flag: 'GB' },
  { code: 'AU-TAS', label: 'Australia — Tasmania', flag: 'AU' },
  { code: 'AU-VIC', label: 'Australia — Victoria', flag: 'AU' },
  { code: 'FR', label: 'France', flag: 'FR' },
  { code: 'SV', label: 'El Salvador', flag: 'SV' },
  { code: 'RO', label: 'Romania', flag: 'RO' },
  { code: 'ES-MD', label: 'Spain — Community of Madrid', flag: 'ES' },
  { code: 'ES-MC', label: 'Spain — Murcia (Region of)', flag: 'ES' },
  { code: 'ES-CT', label: 'Spain — Catalonia (e.g. Barcelona)', flag: 'ES' },
];

const KNOWN_REGIONS: Record<string, HolidayRegion> = Object.fromEntries(
  REGION_LIST.map((d) => [
    d.code,
    { code: d.code, label: d.label, flag: d.flag, loader: loaderFor(d.code) } satisfies HolidayRegion,
  ]),
);

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
