import { getPresetRange } from '../../domain/reports';

describe('report range presets', () => {
  it('builds today, last 7 days, and month ranges', () => {
    const date = new Date('2026-07-07T12:00:00');
    const today = getPresetRange('today', date);
    const last7Days = getPresetRange('last7Days', date);
    const month = getPresetRange('thisMonth', date);

    expect(today.end).toBeGreaterThan(today.start);
    expect(Math.round((last7Days.end - last7Days.start + 1) / 86400000)).toBe(7);
    expect(new Date(month.start).getDate()).toBe(1);
  });
});
