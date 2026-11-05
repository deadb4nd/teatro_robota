"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loading, Notice } from "@/components/Notice";
import { MonthNav } from "@/components/MonthNav";
import { errorMessage, getJson, setQueryParam } from "@/lib/client";
import {
  formatDateLong,
  formatDayShort,
  formatMonthTitle,
  formatWeekTitle,
  normalizeMonth,
} from "@/lib/dates";
import { formatHours } from "@/lib/hours";
import { roleFor } from "@/lib/roles";
import type { MonthData, ShiftWithPerson } from "@/lib/types";

type Props = {
  initialMonth?: string | null;
};

function shiftKey(shift: ShiftWithPerson) {
  return `${shift.date}|${shift.role}|${shift.slot}`;
}

export function MiesiacClient({ initialMonth }: Props) {
  const [month, setMonth] = useState(() =>
    initialMonth ? normalizeMonth(initialMonth) : "",
  );
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!month) setMonth(normalizeMonth(null));
  }, [month]);

  useEffect(() => {
    if (!month) return;
    let cancelled = false;

    setLoading(true);
    setLoadError(null);

    getJson<MonthData>(`/api/month?month=${month}`)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(errorMessage(error));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month]);

  function changeMonth(nextMonth: string) {
    const normalized = normalizeMonth(nextMonth);
    setMonth(normalized);
    setQueryParam("month", normalized);
    setLoading(true);
  }

  const sortedPeople = useMemo(() => {
    if (!data) return [];
    return [...data.people].sort((a, b) => {
      if (b.workedMinutes !== a.workedMinutes) {
        return b.workedMinutes - a.workedMinutes;
      }
      return a.name.localeCompare(b.name, "pl");
    });
  }, [data]);

  const peopleWithHours = sortedPeople.filter(
    (person) => person.workedMinutes > 0,
  ).length;

  if (!month) {
    return <Loading label="Ustalanie miesiąca…" />;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Podsumowanie</span>
          <h1>Miesiąc</h1>
        </div>
        <div className="head-actions">
          <Link className="secondary-btn" href="/grafik">
            Otwórz grafik
          </Link>
        </div>
      </div>

      <MonthNav month={month} onChange={changeMonth} />

      {loadError ? <Notice kind="error">{loadError}</Notice> : null}

      {loading ? (
        <Loading />
      ) : !data ? (
        <div className="empty-state">Brak danych.</div>
      ) : (
        <>
          <div className="stat-row">
            <div className="mini-stat">
              <span>Przepracowane</span>
              <strong>{formatHours(data.totalMinutes)}</strong>
              <small>w {formatMonthTitle(data.month)}</small>
            </div>
            <div className="mini-stat">
              <span>Zmiany</span>
              <strong>{data.totalShifts}</strong>
              <small>zaplanowane w miesiącu</small>
            </div>
            <div className="mini-stat">
              <span>Brak odbicia</span>
              <strong>{data.missingClockOut}</strong>
              <small>zmian bez godziny wyjścia</small>
            </div>
            <div className="mini-stat">
              <span>Osoby</span>
              <strong>
                {peopleWithHours}/{data.people.length}
              </strong>
              <small>z przepracowanymi godzinami</small>
            </div>
          </div>

          <section className="month-section">
            <div className="section-head">
              <h2>Godziny osób</h2>
              <span className="muted">Suma na podstawie godzin wyjścia</span>
            </div>

            <div className="table-card">
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Osoba</th>
                      <th>Zmiany</th>
                      <th>Przepracowane</th>
                      <th>Brak odbicia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPeople.map((person) => (
                      <tr key={person.personId}>
                        <td>
                          <strong>{person.name}</strong>
                        </td>
                        <td>
                          {person.shifts}
                          {person.workedShifts !== person.shifts ? (
                            <small className="cell-note">
                              {" "}
                              ({person.workedShifts} rozliczonych)
                            </small>
                          ) : null}
                        </td>
                        <td>
                          <strong>{formatHours(person.workedMinutes)}</strong>
                        </td>
                        <td>
                          {person.missingClockOut ? (
                            <span className="warn-text">
                              {person.missingClockOut}
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {sortedPeople.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="muted">
                          Brak osób.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="month-section">
            <div className="section-head">
              <h2>Weekendy</h2>
              <span className="muted">Kliknij weekend, żeby zwinąć szczegóły</span>
            </div>

            <div className="week-cards">
              {data.weeks.map((week) => (
                <details className="week-card" key={week.friday} open>
                  <summary>
                    <div className="week-summary-main">
                      <strong>
                        {formatWeekTitle(week.friday, week.saturday)}
                      </strong>
                      <span>
                        {week.totalShifts} zmian · {formatHours(week.totalMinutes)}
                        {week.missingClockOut
                          ? ` · ${week.missingClockOut} bez odbicia`
                          : ""}
                      </span>
                    </div>
                    <Link
                      className="secondary-btn compact"
                      href={`/grafik?week=${week.friday}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Edytuj
                    </Link>
                  </summary>

                  <div className="week-days">
                    {week.days.map((day) => (
                      <div className="day-summary" key={day.date}>
                        <div className="day-summary-head">
                          <strong>
                            {day.date === week.friday ? "Piątek" : "Sobota"}{" "}
                            {formatDayShort(day.date)}
                          </strong>
                          <span>
                            {day.totalShifts} zmian ·{" "}
                            {formatHours(day.totalMinutes)}
                            {day.missingClockOut
                              ? ` · ${day.missingClockOut} bez odbicia`
                              : ""}
                          </span>
                        </div>
                        <div className="day-summary-date">
                          {formatDateLong(day.date)}
                        </div>

                        {day.shifts.length ? (
                          <div className="month-shift-list">
                            {day.shifts.map((shift) => {
                              const role = roleFor(shift.role);
                              return (
                                <div
                                  className="month-shift"
                                  key={shiftKey(shift)}
                                >
                                  <span
                                    className="role-badge"
                                    style={{
                                      background: role?.color ?? "#4f46e5",
                                    }}
                                  >
                                    {role?.label ?? shift.role}
                                  </span>
                                  <span className="month-shift-name">
                                    {shift.personName}
                                  </span>
                                  <span className="month-shift-time">
                                    {shift.startTime ?? "—"}
                                    {shift.clockOut
                                      ? `–${shift.clockOut}`
                                      : ""}
                                  </span>
                                  <span className="month-shift-hours">
                                    {shift.minutes !== null ? (
                                      formatHours(shift.minutes)
                                    ) : shift.startTime ? (
                                      <span className="warn-text">
                                        brak odbicia
                                      </span>
                                    ) : (
                                      <span className="muted">brak startu</span>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="muted small">Brak zmian.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>

          <p className="hint">
            Godziny liczone są od startu z grafiku do wpisanej godziny wyjścia.
            Zmiany po północy są liczone jako następny dzień.{" "}
            <Link href={`/godziny?week=${data.weeks[0]?.friday ?? month}`}>
              Uzupełnij godziny wyjścia
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
