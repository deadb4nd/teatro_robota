"use client";

import { addMonths, formatMonthTitle, normalizeMonth } from "@/lib/dates";

type Props = {
  month: string;
  onChange: (month: string) => void;
};

export function MonthNav({ month, onChange }: Props) {
  return (
    <div className="period-nav">
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Poprzedni miesiąc"
      >
        ←
      </button>
      <div className="period-label">
        <span className="eyebrow">Miesiąc</span>
        <strong>{formatMonthTitle(month)}</strong>
      </div>
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(addMonths(month, 1))}
        aria-label="Następny miesiąc"
      >
        →
      </button>
      <button
        type="button"
        className="ghost-btn compact"
        onClick={() => onChange(normalizeMonth(null))}
      >
        Ten miesiąc
      </button>
    </div>
  );
}
