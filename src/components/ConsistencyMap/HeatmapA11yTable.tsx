import { Table, VisuallyHidden } from '@mantine/core';

import type { HeatmapRow } from './contributions';
import type { CellAdornment } from './ConsistencyMap';

// a11y fallback: hidden `<table>` of `date | contribution count | adornment`
// so screen readers and automated tests can read the data without depending
// on the visual heatmap.

type Props = {
  rows: HeatmapRow[];
  adornments?: (date: string) => CellAdornment | undefined;
  caption: string;
};

export function HeatmapA11yTable({ rows, adornments, caption }: Props): JSX.Element {
  return (
    <VisuallyHidden>
      <Table role="table" aria-label={caption}>
        <caption>{caption}</caption>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>date</Table.Th>
            <Table.Th>contributions</Table.Th>
            <Table.Th>note</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => {
            const note = adornments?.(row.date);
            return (
              <Table.Tr key={row.date}>
                <Table.Td>{row.date}</Table.Td>
                <Table.Td>{row.count}</Table.Td>
                <Table.Td>{note?.label ?? ''}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </VisuallyHidden>
  );
}
