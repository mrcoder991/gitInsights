export type HolidayListRow = {
  date: string;
  name: string;
  timing: 'upcoming' | 'past';
};

function holidayIsUpcoming(date: string, today: Date): boolean {
  const d = new Date(`${date}T00:00:00`);
  const t = new Date(today);
  return d.getTime() >= t.setHours(0, 0, 0, 0);
}

/** Flatten lookup into rows, ordered: upcoming (soonest first), then past (most recent first). */
export function holidayRowsFromLookup(
  lookup: Map<string, { name: string }[]>,
  today = new Date(),
): HolidayListRow[] {
  const rows: HolidayListRow[] = [];
  for (const [date, items] of lookup) {
    const upcoming = holidayIsUpcoming(date, new Date(today));
    const timing: HolidayListRow['timing'] = upcoming ? 'upcoming' : 'past';
    for (const item of items) rows.push({ date, name: item.name, timing });
  }
  rows.sort((a, b) => {
    if (a.timing !== b.timing) return a.timing === 'upcoming' ? -1 : 1;
    if (a.timing === 'upcoming') return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });
  return rows;
}
