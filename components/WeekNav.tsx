"use client";

import { addDays, currentWeekStart, formatWeekTitle } from "@/lib/dates";

type Props = {
  weekStart: string;
  onChange: (week: string) => void;
};

export function WeekNav({ weekStart, onChange }: Props) {
  return (
    <div className="period-nav">
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(addDays(weekStart, -7))}
        aria-label="Poprzedni weekend"
      >
        ←
      </button>
      <div className="period-label">
        <span className="eyebrow">Weekend</span>
        <strong>{formatWeekTitle(weekStart, addDays(weekStart, 1))}</strong>
      </div>
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(addDays(weekStart, 7))}
        aria-label="Następny weekend"
      >
        →
      </button>
      <button
        type="button"
        className="ghost-btn compact"
        onClick={() => onChange(currentWeekStart())}
      >
        Dziś
      </button>
    </div>
  );
}
