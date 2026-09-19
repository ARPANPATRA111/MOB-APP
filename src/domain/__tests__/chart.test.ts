import { groupSalesForChart } from '../chart';
test('long report charts retain every day and total', () => {
  const points = Array.from({ length: 31 }, (_, i) => ({ label: `2026-01-${String(i + 1).padStart(2, '0')}`, sales: i + 1 }));
  const grouped = groupSalesForChart(points);
  expect(grouped.length).toBeLessThanOrEqual(12);
  expect(grouped.reduce((sum, bar) => sum + bar.value, 0)).toBe(496);
  expect(grouped.at(-1)?.key).toContain('31 Jan');
  expect(groupSalesForChart([])).toEqual([]);
});
