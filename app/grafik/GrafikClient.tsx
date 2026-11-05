"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
import { ROLES } from "@/lib/roles";
import type { Availability, Person, Shift, WeekData } from "@/lib/types";
import { downloadWeekImage, shareWeekImage } from "@/lib/weekImage";

type Props = {
  initialWeek?: string | null;
};

type Flash = {
  kind: "info" | "success" | "error" | "warning";
  text: string;
};

function emptyShift(date: string, role: string, slot: number): Shift {
  return { date, role, slot, personId: null, startTime: null, clockOut: null };
}

function buildFullShifts(data: WeekData): Shift[] {
  const existing = new Map(
    data.shifts.map((shift) => [
      `${shift.date}|${shift.role}|${shift.slot}`,
      shift,
    ]),
  );
  const result: Shift[] = [];

  for (const date of [data.friday, data.saturday]) {
    for (const role of ROLES) {
      for (let slot = 0; slot < role.slots; slot++) {
        const key = `${date}|${role.key}|${slot}`;
        result.push(existing.get(key) ?? emptyShift(date, role.key, slot));
      }
    }
  }

  return result;
}

export function GrafikClient({ initialWeek }: Props) {
  const [week, setWeek] = useState(() =>
    initialWeek ? normalizeWeekStart(initialWeek) : "",
  );
  const [people, setPeople] = useState<Person[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const changeVersionRef = useRef(0);

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
    setSaveError(null);
    setSaveState("idle");
    setDirty(false);

    getJson<WeekData>(`/api/week?week=${week}`)
      .then((data) => {
        if (cancelled) return;
        setPeople(data.people);
        setAvailability(data.availability);
        setShifts(buildFullShifts(data));
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

  const changeWeek = useCallback((nextWeek: string) => {
    const normalized = normalizeWeekStart(nextWeek);
    setWeek(normalized);
    setQueryParam("week", normalized);
    setLoading(true);
    setDirty(false);
  }, []);

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift>();
    for (const shift of shifts) {
      map.set(`${shift.date}|${shift.role}|${shift.slot}`, shift);
    }
    return map;
  }, [shifts]);

  const availabilityMap = useMemo(() => {
    const map = new Map<string, Availability>();
    for (const entry of availability) {
      map.set(`${entry.personId}|${entry.date}`, entry);
    }
    return map;
  }, [availability]);

  const availableForDay = useMemo(() => {
    const result = new Map<
      string,
      Array<{ person: Person; preferredStart: string | null }>
    >();

    for (const date of [friday, saturday]) {
      if (!date) continue;
      const list = people.flatMap((person) => {
        const entry = availabilityMap.get(`${person.id}|${date}`);
        return entry?.available
          ? [{ person, preferredStart: entry.preferredStart }]
          : [];
      });
      result.set(date, list);
    }

    return result;
  }, [availabilityMap, friday, people, saturday]);

  const assignedCount = useMemo(
    () => shifts.filter((shift) => shift.personId !== null).length,
    [shifts],
  );

  const setShift = useCallback(
    (date: string, role: string, slot: number, patch: Partial<Shift>) => {
      setShifts((current) => {
        let found = false;
        const next = current.map((shift) => {
          if (
            shift.date === date &&
            shift.role === role &&
            shift.slot === slot
          ) {
            found = true;
            return { ...shift, ...patch };
          }
          return shift;
        });

        if (!found) {
          next.push({ ...emptyShift(date, role, slot), ...patch });
        }

        return next;
      });

      changeVersionRef.current += 1;
      setDirty(true);
      setSaveState("idle");
    },
    [],
  );

  const saveNow = useCallback(async () => {
    if (!week) return;
    const version = changeVersionRef.current;
    setSaveState("saving");
    setSaveError(null);

    try {
      await sendJson("/api/week", "PUT", { shifts });
      if (changeVersionRef.current === version) {
        setSaveState("saved");
        setDirty(false);
      }
    } catch (error) {
      setSaveState("error");
      setSaveError(errorMessage(error));
    }
  }, [shifts, week]);

  useEffect(() => {
    if (!dirty || loading || !week) return;
    const version = changeVersionRef.current;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      setSaveError(null);

      try {
        await sendJson("/api/week", "PUT", { shifts });
        if (changeVersionRef.current === version) {
          setSaveState("saved");
          setDirty(false);
        }
      } catch (error) {
        setSaveState("error");
        setSaveError(errorMessage(error));
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [dirty, loading, shifts, week]);

  function setAvailabilityFor(personId: number, date: string) {
    return availabilityMap.get(`${personId}|${date}`);
  }

  function handlePersonChange(
    date: string,
    role: string,
    slot: number,
    rawValue: string,
  ) {
    const personId = rawValue ? Number(rawValue) : null;
    setShift(
      date,
      role,
      slot,
      personId
        ? { personId, clockOut: null }
        : { personId: null, startTime: null, clockOut: null },
    );
  }

  function handleTimeChange(
    date: string,
    role: string,
    slot: number,
    value: string,
  ) {
    setShift(date, role, slot, {
      startTime: normalizeTime(value),
    });
  }

  function autoFill() {
    if (!week) return;
    const next = shifts.map((shift) => ({ ...shift }));

    const findShift = (date: string, role: string, slot: number) =>
      next.find(
        (shift) =>
          shift.date === date && shift.role === role && shift.slot === slot,
      );

    for (const date of [friday, saturday]) {
      const used = new Set<number>();
      for (const shift of next) {
        if (shift.date === date && shift.personId) used.add(shift.personId);
      }

      for (const role of ROLES) {
        for (let slot = 0; slot < role.slots; slot++) {
          const shift = findShift(date, role.key, slot);
          if (!shift || shift.personId) continue;

          const candidates = people
            .filter((person) => {
              const entry = availabilityMap.get(`${person.id}|${date}`);
              return entry?.available && !used.has(person.id);
            })
            .sort((a, b) => {
              const aStart =
                availabilityMap.get(`${a.id}|${date}`)?.preferredStart ?? "";
              const bStart =
                availabilityMap.get(`${b.id}|${date}`)?.preferredStart ?? "";
              if (aStart && bStart) return aStart.localeCompare(bStart);
              if (aStart) return -1;
              if (bStart) return 1;
              return a.name.localeCompare(b.name, "pl");
            });

          const person = candidates[0];
          if (!person) continue;

          used.add(person.id);
          shift.personId = person.id;
          if (!shift.startTime) {
            const preferred = availabilityMap.get(
              `${person.id}|${date}`,
            )?.preferredStart;
            if (preferred) shift.startTime = preferred;
          }
        }
      }

      for (const shift of next) {
        if (
          shift.date !== date ||
          !shift.personId ||
          shift.startTime
        ) {
          continue;
        }
        const preferred = availabilityMap.get(
          `${shift.personId}|${date}`,
        )?.preferredStart;
        if (preferred) shift.startTime = preferred;
      }
    }

    setShifts(next);
    changeVersionRef.current += 1;
    setDirty(true);
    setSaveState("idle");
    setFlash({
      kind: "info",
      text: "Auto-uzupełnienie dobrało dostępne osoby. Sprawdź godziny rozpoczęcia przed wysłaniem grafiku.",
    });
  }

  function clearWeek() {
    if (
      !window.confirm(
        "Wyczyścić cały grafik na ten weekend? Usunięte zostaną też zapisane godziny wyjścia.",
      )
    ) {
      return;
    }

    setShifts(
      shifts.map((shift) => ({
        ...shift,
        personId: null,
        startTime: null,
        clockOut: null,
      })),
    );
    changeVersionRef.current += 1;
    setDirty(true);
    setSaveState("idle");
    setFlash({ kind: "warning", text: "Grafik został wyczyszczony." });
  }

  async function handleDownload() {
    if (!week) return;
    setImageBusy(true);
    setFlash(null);
    try {
      await downloadWeekImage({ weekStart: week, saturday, shifts, people });
      setFlash({ kind: "success", text: "Obrazek grafiku został pobrany." });
    } catch (error) {
      setFlash({ kind: "error", text: errorMessage(error) });
    } finally {
      setImageBusy(false);
    }
  }

  async function handleShare() {
    if (!week) return;
    setImageBusy(true);
    setFlash(null);
    try {
      const result = await shareWeekImage({
        weekStart: week,
        saturday,
        shifts,
        people,
      });
      setFlash({
        kind: "success",
        text:
          result === "shared"
            ? "Grafik został udostępniony."
            : "Obrazek został pobrany — możesz wysłać go w grupie.",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setFlash({ kind: "error", text: errorMessage(error) });
    } finally {
      setImageBusy(false);
    }
  }

  function renderDayEditor(date: string, role: string, slot: number) {
    const shift =
      shiftMap.get(`${date}|${role}|${slot}`) ?? emptyShift(date, role, slot);
    const entry = shift.personId
      ? availabilityMap.get(`${shift.personId}|${date}`)
      : undefined;
    const warned = Boolean(shift.personId && entry && !entry.available);
    const preferred = shift.personId
      ? availabilityMap.get(`${shift.personId}|${date}`)?.preferredStart
      : null;

    return (
      <div className={`day-editor${warned ? " warned" : ""}`}>
        <select
          value={shift.personId ? String(shift.personId) : ""}
          onChange={(event) =>
            handlePersonChange(date, role, slot, event.target.value)
          }
          aria-label={`Osoba ${role} ${slot + 1}, ${formatDateLong(date)}`}
        >
          <option value="">— wolne —</option>
          {people.map((person) => {
            const personEntry = setAvailabilityFor(person.id, date);
            const suffix = personEntry
              ? personEntry.available
                ? " · dostępna"
                : " · niedostępna"
              : "";
            return (
              <option key={person.id} value={person.id}>
                {person.name}
                {suffix}
              </option>
            );
          })}
        </select>

        <div className="time-wrap">
          <input
            type="time"
            value={shift.startTime ?? ""}
            disabled={!shift.personId}
            onChange={(event) =>
              handleTimeChange(date, role, slot, event.target.value)
            }
            aria-label={`Godzina rozpoczęcia ${role} ${slot + 1}, ${formatDateLong(date)}`}
            title={
              preferred
                ? `Preferowana godzina: ${preferred}`
                : "Godzina rozpoczęcia"
            }
          />
          {shift.personId && shift.startTime ? (
            <button
              type="button"
              className="clear-time"
              onClick={() =>
                setShift(date, role, slot, {
                  startTime: null,
                  clockOut: null,
                })
              }
              aria-label="Wyczyść godzinę"
            >
              ×
            </button>
          ) : null}
        </div>

        {warned ? (
          <span
            className="warn-flag"
            title="Osoba zgłosiła niedostępność w tym dniu"
          >
            !
          </span>
        ) : null}
      </div>
    );
  }

  if (!week) {
    return <Loading label="Ustalanie weekendu…" />;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Plan tygodnia</span>
          <h1>Grafik weekendowy</h1>
        </div>
        <div className={`save-status ${saveState}`}>
          <span className="status-dot" />
          {saveState === "saving"
            ? "Zapisywanie…"
            : saveState === "saved"
              ? "Zapisano"
              : saveState === "error"
                ? "Błąd zapisu"
                : dirty
                  ? "Niezapisane zmiany"
                  : "Zapis automatyczny"}
          {saveState === "error" ? (
            <button type="button" className="link-btn" onClick={saveNow}>
              Ponów
            </button>
          ) : null}
        </div>
      </div>

      <WeekNav weekStart={week} onChange={changeWeek} />

      <div className="toolbar">
        <button
          type="button"
          className="primary-btn"
          onClick={handleDownload}
          disabled={imageBusy || !assignedCount}
        >
          Pobierz PNG
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={handleShare}
          disabled={imageBusy || !assignedCount}
        >
          Udostępnij
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={autoFill}
          disabled={!people.length}
        >
          Auto-uzupełnij
        </button>
        <button
          type="button"
          className="ghost-btn danger"
          onClick={clearWeek}
          disabled={!assignedCount}
        >
          Wyczyść
        </button>
      </div>

      {flash ? <Notice kind={flash.kind}>{flash.text}</Notice> : null}
      {loadError ? <Notice kind="error">{loadError}</Notice> : null}
      {saveState === "error" && saveError ? (
        <Notice kind="error">Nie udało się zapisać: {saveError}</Notice>
      ) : null}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="availability-strip">
            {[friday, saturday].map((date) => {
              const list = availableForDay.get(date) ?? [];
              return (
                <div className="availability-card" key={date}>
                  <div className="availability-head">
                    <strong>
                      {date === friday ? "Piątek" : "Sobota"}{" "}
                      <span>{formatDayShort(date)}</span>
                    </strong>
                    <span>
                      {list.length}/{people.length} dostępnych
                    </span>
                  </div>
                  <div className="chips">
                    {list.length ? (
                      list.map(({ person, preferredStart }) => (
                        <span className="chip available" key={person.id}>
                          {person.name}
                          {preferredStart ? ` · od ${preferredStart}` : ""}
                        </span>
                      ))
                    ) : (
                      <span className="muted">Brak zgłoszeń dostępności</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {people.length === 0 ? (
            <div className="empty-state">
              <strong>Nie masz jeszcze żadnych osób.</strong>
              <p>
                Dodaj osoby, żeby móc układać grafik.{" "}
                <Link href="/osoby">Przejdź do listy osób</Link>.
              </p>
            </div>
          ) : (
            <div className="table-card">
              <div className="table-scroll">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th className="role-head">Rola</th>
                      <th>
                        <span>Piątek</span>
                        <small>{formatDayShort(friday)}</small>
                      </th>
                      <th>
                        <span>Sobota</span>
                        <small>{formatDayShort(saturday)}</small>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map((role) => (
                      <Fragment key={role.key}>
                        {Array.from({ length: role.slots }, (_, slot) => (
                          <tr
                            key={`${role.key}-${slot}`}
                            className={slot === 0 ? "role-start" : undefined}
                            style={
                              {
                                "--role": role.color,
                                "--role-soft": role.soft,
                              } as CSSProperties
                            }
                          >
                            {slot === 0 ? (
                              <th
                                rowSpan={role.slots}
                                className={
                                  role.slots === 1
                                    ? "role-cell single"
                                    : "role-cell"
                                }
                                scope="rowgroup"
                              >
                                <span>{role.label}</span>
                              </th>
                            ) : null}
                            <td>{renderDayEditor(friday, role.key, slot)}</td>
                            <td>{renderDayEditor(saturday, role.key, slot)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="hint">
            Wybierz osobę i godzinę rozpoczęcia dla każdego dnia osobno. Osoby
            oznaczone jako niedostępne nadal możesz przypisać — dostaniesz
            ostrzeżenie. Zmiany zapisują się automatycznie.{" "}
            <Link href={`/godziny?week=${week}`}>Przejdź do godzin wyjścia</Link>
            {" · "}
            <Link href={`/miesiac?month=${week.slice(0, 7)}`}>
              Zobacz miesiąc
            </Link>
            {" · "}
            <Link href={`/dostepnosc?week=${week}`}>Dostępność</Link>.
          </p>
        </>
      )}
    </div>
  );
}
