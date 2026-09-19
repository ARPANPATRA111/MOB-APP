export interface DailyPoint {
  /** Day key in `yyyy-mm-dd`. */
  label: string;
  sales: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** `2026-09-16` → `16 Sep`. */
export const shortDay = (key: string) => {
  const date = parseDay(key);
  return Number.isNaN(date.getTime()) ? key : `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

/**
 * Axis label for a bar: weekday names for a week or less, day numbers for a
 * month, and `d Mon` for grouped ranges.
 */
const axisLabel = (key: string, totalDays: number, grouped: boolean) => {
  const date = parseDay(key);
  if (Number.isNaN(date.getTime())) return key;
  if (grouped) return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  if (totalDays <= 7) return WEEKDAYS[date.getDay()];
  return String(date.getDate());
};

/** Reduce long ranges without dropping early days or changing their total. */
export function groupSalesForChart(points: DailyPoint[], maxBars = 12) {
  const width = Math.max(1, Math.ceil(points.length / Math.max(1, maxBars)));
  const grouped = width > 1;
  const result: { key: string; label: string; value: number }[] = [];
  for (let i = 0; i < points.length; i += width) {
    const group = points.slice(i, i + width);
    const first = group[0].label;
    const last = group[group.length - 1].label;
    result.push({
      key: first === last ? shortDay(first) : `${shortDay(first)} – ${shortDay(last)}`,
      label: axisLabel(first, points.length, grouped),
      value: group.reduce((sum, point) => sum + point.sales, 0),
    });
  }
  return result;
}
