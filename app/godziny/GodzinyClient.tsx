"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loading, Notice } from "@/components/Notice";
import { WeekNav } from "@/components/WeekNav";
import { errorMessage, getJson, sendJson, setQueryParam } from "@/lib/client";
import {
  addDays,
  currentWeekStart,
  formatDateLong,
  formatDayShort,
  normalizeWeekStart,
} from "@/lib/dates";
import { formatDuration, formatHours, minutesBetween } from "@/lib/hours";
import { ROLES, roleFor } from "@/lib/roles";
import type { Person, Shift, WeekData } from "@/lib/types";

type Props = {
  initialWeek?: string | null;
};

type Flash = {
  kind: "info" | "success" | "error" | "warning";
  text: string;
};

const ROLE_ORDER = new Map(ROLES.map((role, index) => [role.key, index]));

function keyFor(shift: Pick<Shift, "date" | "role" | "slot">) {
  return `${shift.date}|${shift.role}|${shift.slot}`;
}

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}

export function GodzinyClient({ initialWeek }: Props) {
  const [week, setWeek] = useState(() =>
    initialWeek ? normalizeWeekStart(initialWeek) : "",
  );
  const [people, setPeople] = useState<Person[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [clockOuts, setClockOuts] = useState<Record<string, string>>({});
  const [personFilter, setPersonFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);

  const friday = week;
  const saturday = week ? addDays(week, 1) : "";

  useEffect(() => {
    if (!week) setWeek(currentWeekStart());
  }, [week]);

  useEffect(() => {
    if (!week) return;
    let cancelled = false;

    setLoading(true);
    setLoadError(null);
    setFlash(null);
    setDirty(false);
    setSaved(false);

    getJson<WeekData>(`/api/week?week=${week}`)
      .then((data) => {
        if (cancelled) return;
        setPeople(data.people);
        setShifts(data.shifts);
        setClockOuts(
          Object.fromEntries(
            data.shifts.map((shift) => [keyFor(shift), shift.clockOut ?? ""]),
          ),
        );
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
  }, [week]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function changeWeek(nextWeek: string) {
    if (
      dirty &&
      !window.confirm("Masz niezapisane godziny. Odrzucić zmiany?")
    ) {
      return;
    }
    const normalized = normalizeWeekStart(nextWeek);
    setWeek(normalized);
    setQueryParam("week", normalized);
    setPersonFilter("all");
    setLoading(true);
    setDirty(false);
  }

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const assignedShifts = useMemo(
    () =>
      shifts
        .filter((shift) => shift.personId !== null)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          const roleDiff =
            (ROLE_ORDER.get(a.role) ?? 99) - (ROLE_ORDER.get(b.role) ?? 99);
          return roleDiff || a.slot - b.slot;
        }),
    [shifts],
  );

  const filteredShifts = useMemo(() => {
    if (personFilter === "all") return assignedShifts;
    const personId = Number(personFilter);
    return assignedShifts.filter((shift) => shift.personId === personId);
  }, [assignedShifts, personFilter]);

  const grouped = useMemo(() => {
    const groups: Array<{ date: string; shifts: Shift[] }> = [];
    for (const shift of filteredShifts) {
      const last = groups[groups.length - 1];
      if (last && last.date === shift.date) last.shifts.push(shift);
      else groups.push({ date: shift.date, shifts: [shift] });
    }
    return groups;
  }, [filteredShifts]);

  const personTotals = useMemo(() => {
    const totals = new Map<
      number,
      { person: Person; minutes: number; shifts: number; missing: number }
    >();

    for (const shift of assignedShifts) {
      if (shift.personId === null) continue;
      const person = peopleById.get(shift.personId);
      if (!person) continue;
      const current = totals.get(person.id) ?? {
        person,
        minutes: 0,
        shifts: 0,
        missing: 0,
      };
      const minutes = minutesBetween(
        shift.startTime,
        clockOuts[keyFor(shift)] || null,
      );
      current.shifts += 1;
      if (minutes !== null) current.minutes += minutes;
      else if (shift.startTime && !clockOuts[keyFor(shift)]) current.missing += 1;
      totals.set(person.id, current);
    }

    return Array.from(totals.values()).sort((a, b) =>
      a.person.name.localeCompare(b.person.name, "pl"),
    );
  }, [assignedShifts, clockOuts, peopleById]);

  const visibleTotals = useMemo(() => {
    if (personFilter === "all") return personTotals;
    const personId = Number(personFilter);
    return personTotals.filter((total) => total.person.id === personId);
  }, [personFilter, personTotals]);

  const totalMinutes = visibleTotals.reduce(
    (sum, total) => sum + total.minutes,
    0,
  );
  const missingClockOuts = visibleTotals.reduce(
    (sum, total) => sum + total.missing,
    0,
  );

  function updateClockOut(shift: Shift, value: string) {
    const key = keyFor(shift);
    setClockOuts((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
    setFlash(null);
  }

  async function save() {
    if (!week || !assignedShifts.length) return;
    setSaving(true);
    setFlash(null);

    try {
      await sendJson("/api/hours", "PUT", {
        shifts: assignedShifts.map((shift) => ({
          date: shift.date,
          role: shift.role,
          slot: shift.slot,
          clockOut: clockOuts[keyFor(shift)] || null,
        })),
      });

      setShifts((current) =>
        current.map((shift) => {
          const key = keyFor(shift);
          if (!(key in clockOuts)) return shift;
          return { ...shift, clockOut: clockOuts[key] || null };
        }),
      );
      setDirty(false);
      setSaved(true);
      setFlash({ kind: "success", text: "Godziny zostały zapisane." });
    } catch (error) {
      setFlash({ kind: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  if (!week) {
    return <Loading label="Ustalanie weekendu…" />;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Rozliczenie</span>
          <h1>Godziny wyjścia</h1>
        </div>
        <div className="head-actions">
          <Link className="secondary-btn" href={`/grafik?week=${week}`}>
            Otwórz grafik
          </Link>
        </div>
      </div>

      <WeekNav weekStart={week} onChange={changeWeek} />

      <Notice kind="info">
        Po zakończeniu zmiany wpisz godzinę wyjścia. Jeśli wychodzisz po
        północy, wpisz np. <strong>02:00</strong> — system sam policzy nocną
        zmianę. Godzina rozpoczęcia pochodzi z grafiku.
      </Notice>

      {flash ? <Notice kind={flash.kind}>{flash.text}</Notice> : null}
      {loadError ? <Notice kind="error">{loadError}</Notice> : null}

      {loading ? (
        <Loading />
      ) : assignedShifts.length === 0 ? (
        <div className="empty-state">
          <strong>Nie ma jeszcze żadnych zmian na ten weekend.</strong>
          <p>
            Najpierw ułóż grafik. <Link href={`/grafik?week=${week}`}>Otwórz grafik</Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="filter-bar">
            <label>
              <span>Pokaż osobę</span>
              <select
                value={personFilter}
                onChange={(event) => setPersonFilter(event.target.value)}
              >
                <option value="all">Wszyscy</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="stat-row">
            <div className="mini-stat">
              <span>Przepracowane</span>
              <strong>{formatHours(totalMinutes)}</strong>
              <small>w wybranym zakresie</small>
            </div>
            <div className="mini-stat">
              <span>Brak odbicia</span>
              <strong>{missingClockOuts}</strong>
              <small>zmian bez godziny wyjścia</small>
            </div>
            <div className="mini-stat">
              <span>Zmiany</span>
              <strong>
                {visibleTotals.reduce((sum, total) => sum + total.shifts, 0)}
              </strong>
              <small>w wybranym zakresie</small>
            </div>
          </div>

          <div className="person-summary">
            {visibleTotals.map((total) => (
              <div className="person-summary-row" key={total.person.id}>
                <span>{total.person.name}</span>
                <strong>{formatHours(total.minutes)}</strong>
                <small>
                  {total.shifts} {total.shifts === 1 ? "zmiana" : "zmian"}
                  {total.missing ? ` · ${total.missing} bez odbicia` : ""}
                </small>
              </div>
            ))}
          </div>

          {grouped.length === 0 ? (
            <div className="empty-state">
              <strong>Brak zmian dla wybranej osoby w tym weekendzie.</strong>
            </div>
          ) : (
            <div className="hours-list">
              {grouped.map((group) => (
              <section className="hours-day" key={group.date}>
                <div className="hours-day-head">
                  <strong>
                    {group.date === friday ? "Piątek" : "Sobota"}{" "}
                    {formatDayShort(group.date)}
                  </strong>
                  <span>{formatDateLong(group.date)}</span>
                </div>

                <div className="hours-rows">
                  {group.shifts.map((shift) => {
                    const person = shift.personId
                      ? peopleById.get(shift.personId)
                      : undefined;
                    const role = roleFor(shift.role);
                    const key = keyFor(shift);
                    const value = clockOuts[key] ?? "";
                    const minutes = minutesBetween(shift.startTime, value || null);

                    return (
                      <div className="hours-row" key={key}>
                        <span
                          className="role-badge"
                          style={{ background: role?.color ?? "#4f46e5" }}
                        >
                          {role?.label ?? shift.role}
                        </span>

                        <div className="hours-person-name">
                          <strong>{person?.name ?? "—"}</strong>
                          <small>
                            start: {shift.startTime ?? "brak godziny startu"}
                          </small>
                        </div>

                        <div className="hours-input">
                          <input
                            type="time"
                            value={value}
                            disabled={!shift.startTime}
                            onChange={(event) =>
                              updateClockOut(shift, event.target.value)
                            }
                            aria-label={`Godzina wyjścia, ${person?.name ?? "osoba"}, ${formatDateLong(shift.date)}`}
                          />
                          <button
                            type="button"
                            className="mini-btn"
                            disabled={!shift.startTime}
                            onClick={() => updateClockOut(shift, currentTime())}
                          >
                            Teraz
                          </button>
                        </div>

                        <div className="hours-duration">
                          {!shift.startTime ? (
                            <span className="warn-text">Uzupełnij start</span>
                          ) : minutes !== null ? (
                            <strong>{formatDuration(minutes)}</strong>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              ))}
            </div>
          )}

          <div className="save-bar">
            <span className={dirty ? "dirty-text" : "muted"}>
              {saving
                ? "Zapisywanie…"
                : dirty
                  ? "Masz niezapisane godziny"
                  : saved
                    ? "Zapisano"
                    : "Wpisz godziny wyjścia i zapisz"}
            </span>
            <button
              type="button"
              className="primary-btn"
              onClick={save}
              disabled={saving || (!dirty && saved)}
            >
              {saving ? "Zapisywanie…" : "Zapisz godziny"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
