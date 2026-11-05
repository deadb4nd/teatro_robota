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
  normalizeTime,
  normalizeWeekStart,
} from "@/lib/dates";
import type { Availability, Person, WeekData } from "@/lib/types";

type Props = {
  initialWeek?: string | null;
};

type Entry = {
  available: boolean;
  preferredStart: string | null;
};

type Flash = {
  kind: "info" | "success" | "error" | "warning";
  text: string;
};

function buildEntries(
  people: Person[],
  availability: Availability[],
  friday: string,
  saturday: string,
): Record<string, Entry> {
  const result: Record<string, Entry> = {};

  for (const person of people) {
    for (const date of [friday, saturday]) {
      const existing = availability.find(
        (entry) => entry.personId === person.id && entry.date === date,
      );
      result[`${person.id}|${date}`] = {
        available: existing?.available ?? false,
        preferredStart: existing?.preferredStart ?? null,
      };
    }
  }

  return result;
}

export function DostepnoscClient({ initialWeek }: Props) {
  const [week, setWeek] = useState(() =>
    initialWeek ? normalizeWeekStart(initialWeek) : "",
  );
  const [people, setPeople] = useState<Person[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
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
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

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
        setEntries(
          buildEntries(data.people, data.availability, data.friday, data.saturday),
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

  function changeWeek(nextWeek: string) {
    if (
      dirty &&
      !window.confirm("Masz niezapisane zmiany. Odrzucić je?")
    ) {
      return;
    }
    const normalized = normalizeWeekStart(nextWeek);
    setWeek(normalized);
    setQueryParam("week", normalized);
    setLoading(true);
    setDirty(false);
  }

  function updateEntry(personId: number, date: string, patch: Partial<Entry>) {
    const key = `${personId}|${date}`;
    setEntries((current) => {
      const previous = current[key] ?? {
        available: false,
        preferredStart: null,
      };
      const next = { ...previous, ...patch };
      if (!next.available) next.preferredStart = null;
      return { ...current, [key]: next };
    });
    setDirty(true);
    setSaved(false);
    setFlash(null);
  }

  const availabilityCounts = useMemo(() => {
    if (!week) return { friday: 0, saturday: 0 };
    let fridayCount = 0;
    let saturdayCount = 0;

    for (const person of people) {
      if (entries[`${person.id}|${friday}`]?.available) fridayCount += 1;
      if (entries[`${person.id}|${saturday}`]?.available) saturdayCount += 1;
    }

    return { friday: fridayCount, saturday: saturdayCount };
  }, [entries, friday, people, saturday, week]);

  async function save() {
    if (!week || !people.length) return;
    setSaving(true);
    setFlash(null);

    const payload = people.flatMap((person) =>
      [friday, saturday].map((date) => {
        const entry = entries[`${person.id}|${date}`];
        return {
          personId: person.id,
          date,
          available: entry?.available ?? false,
          preferredStart: entry?.preferredStart ?? null,
        };
      }),
    );

    try {
      await sendJson("/api/availability", "PUT", {
        dates: [friday, saturday],
        entries: payload,
      });
      setDirty(false);
      setSaved(true);
      setFlash({ kind: "success", text: "Dostępność została zapisana." });
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
          <span className="eyebrow">Zgłoszenia</span>
          <h1>Dostępność na weekend</h1>
        </div>
        <div className="head-actions">
          <Link className="secondary-btn" href={`/grafik?week=${week}`}>
            Otwórz grafik
          </Link>
        </div>
      </div>

      <WeekNav weekStart={week} onChange={changeWeek} />

      <Notice kind="info">
        Każdy może wpisać dostępność za siebie i za innych — bez logowania.
        Działamy na zaufanie. Zaznacz dzień i opcjonalnie preferowaną godzinę
        rozpoczęcia.
      </Notice>

      {flash ? <Notice kind={flash.kind}>{flash.text}</Notice> : null}
      {loadError ? <Notice kind="error">{loadError}</Notice> : null}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="stat-row">
            <div className="mini-stat">
              <span>Piątek {formatDayShort(friday)}</span>
              <strong>
                {availabilityCounts.friday} / {people.length}
              </strong>
              <small>osób dostępnych</small>
            </div>
            <div className="mini-stat">
              <span>Sobota {formatDayShort(saturday)}</span>
              <strong>
                {availabilityCounts.saturday} / {people.length}
              </strong>
              <small>osób dostępnych</small>
            </div>
          </div>

          {people.length === 0 ? (
            <div className="empty-state">
              <strong>Brak osób na liście.</strong>
              <p>
                Najpierw dodaj osoby. <Link href="/osoby">Przejdź do listy osób</Link>.
              </p>
            </div>
          ) : (
            <div className="availability-list">
              {people.map((person) => (
                <section className="person-card" key={person.id}>
                  <div className="person-card-head">
                    <strong>{person.name}</strong>
                  </div>

                  <div className="person-days">
                    {[friday, saturday].map((date) => {
                      const entry = entries[`${person.id}|${date}`] ?? {
                        available: false,
                        preferredStart: null,
                      };
                      const dayName = date === friday ? "Piątek" : "Sobota";

                      return (
                        <div
                          className={`day-choice${entry.available ? " on" : ""}`}
                          key={date}
                        >
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={entry.available}
                              onChange={(event) =>
                                updateEntry(person.id, date, {
                                  available: event.target.checked,
                                })
                              }
                            />
                            <span className="switch-track" aria-hidden="true">
                              <span className="switch-thumb" />
                            </span>
                            <span className="switch-label">
                              <strong>
                                {dayName} {formatDayShort(date)}
                              </strong>
                              <small>{formatDateLong(date)}</small>
                            </span>
                          </label>

                          <label className="preferred">
                            <span>od</span>
                            <input
                              type="time"
                              value={entry.preferredStart ?? ""}
                              disabled={!entry.available}
                              onChange={(event) =>
                                updateEntry(person.id, date, {
                                  preferredStart: normalizeTime(event.target.value),
                                })
                              }
                              aria-label={`Preferowana godzina, ${person.name}, ${dayName}`}
                            />
                          </label>
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
                  ? "Masz niezapisane zmiany"
                  : saved
                    ? "Zapisano"
                    : "Zaznacz dostępność i zapisz"}
            </span>
            <button
              type="button"
              className="primary-btn"
              onClick={save}
              disabled={saving || !people.length || (!dirty && saved)}
            >
              {saving ? "Zapisywanie…" : "Zapisz dostępność"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
