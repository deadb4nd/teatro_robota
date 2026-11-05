import { normalizeTime } from "./dates";

const HOURS_FORMAT = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function minutesBetween(
  start?: string | null,
  end?: string | null,
): number | null {
  const from = normalizeTime(start);
  const to = normalizeTime(end);
  if (!from || !to) return null;

  const [startHours, startMinutes] = from.split(":").map(Number);
  const [endHours, endMinutes] = to.split(":").map(Number);

  let minutes = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

export function formatHours(minutes: number): string {
  return `${HOURS_FORMAT.format(minutes / 60)} h`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
}
