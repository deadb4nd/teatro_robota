const DAY_MONTH = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
});

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const MONTH_YEAR = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
});

export function toISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: string, days: number): string {
  const date = fromISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return toISO(fromISO(value)) === value;
}

export function weekStartForDate(iso: string): string {
  const date = fromISO(iso);
  const day = date.getDay();

  if (day === 5) return iso;
  if (day === 6) return addDays(iso, -1);
  if (day === 0) return addDays(iso, -2);
  return addDays(iso, 5 - day);
}

export function normalizeWeekStart(input?: string | null): string {
  if (input && isISODate(input)) {
    const day = fromISO(input).getDay();
    if (day === 5) return input;
    if (day === 6) return addDays(input, -1);
  }
  const base = input && isISODate(input) ? input : toISO(new Date());
  return weekStartForDate(base);
}

export function currentWeekStart(): string {
  return weekStartForDate(toISO(new Date()));
}

export function normalizeMonth(input?: string | null): string {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [year, month] = input.split("-").map(Number);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return input;
    }
  }
  return toISO(new Date()).slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthFridays(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const last = new Date(year, monthNumber, 0);
  const offset = (first.getDay() - 5 + 7) % 7;
  const friday = new Date(first);
  friday.setDate(first.getDate() - offset);

  const fridays: string[] = [];
  while (friday <= last) {
    const iso = toISO(friday);
    const saturday = addDays(iso, 1);
    if (saturday >= toISO(first)) fridays.push(iso);
    friday.setDate(friday.getDate() + 7);
  }
  return fridays;
}

export function normalizeTime(value?: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDayShort(iso: string): string {
  const date = fromISO(iso);
  return `${String(date.getDate()).padStart(2, "0")}.${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
}

export function formatDateLong(iso: string): string {
  return DAY_MONTH_YEAR.format(fromISO(iso));
}

export function formatMonthTitle(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return MONTH_YEAR.format(new Date(year, monthNumber - 1, 1));
}

export function formatWeekTitle(friday: string, saturday: string): string {
  const start = fromISO(friday);
  const end = fromISO(saturday);

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    const monthName = DAY_MONTH.format(start).replace(/^\d+\s*/, "");
    return `${start.getDate()}–${end.getDate()} ${monthName} ${start.getFullYear()}`;
  }

  return `${DAY_MONTH.format(start)} – ${DAY_MONTH_YEAR.format(end)}`;
}

export function formatWeekTitleShort(friday: string, saturday: string): string {
  return `${formatDayShort(friday)} – ${formatDayShort(saturday)}`;
}
