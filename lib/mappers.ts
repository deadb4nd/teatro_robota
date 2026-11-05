import { normalizeTime } from "./dates";
import type { Availability, Person, Shift } from "./types";

type PersonRow = {
  id: number | string;
  name: string;
};

type AvailabilityRow = {
  person_id: number | string;
  date: string;
  available: boolean;
  preferred_start: string | null;
};

type ShiftRow = {
  date: string;
  role: string;
  slot: number;
  person_id: number | string | null;
  start_time: string | null;
  clock_out: string | null;
};

export function mapPerson(row: PersonRow): Person {
  return { id: Number(row.id), name: row.name };
}

export function mapAvailability(row: AvailabilityRow): Availability {
  return {
    personId: Number(row.person_id),
    date: row.date,
    available: Boolean(row.available),
    preferredStart: normalizeTime(row.preferred_start),
  };
}

export function mapShift(row: ShiftRow): Shift {
  return {
    date: row.date,
    role: row.role,
    slot: Number(row.slot),
    personId: row.person_id === null ? null : Number(row.person_id),
    startTime: normalizeTime(row.start_time),
    clockOut: normalizeTime(row.clock_out),
  };
}
