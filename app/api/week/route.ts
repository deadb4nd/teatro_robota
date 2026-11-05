import { NextRequest, NextResponse } from "next/server";
import { addDays, fromISO, normalizeTime, normalizeWeekStart } from "@/lib/dates";
import { serverErrorMessage } from "@/lib/errors";
import { mapAvailability, mapPerson, mapShift } from "@/lib/mappers";
import { ROLE_BY_KEY } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import type { Shift } from "@/lib/types";

type IncomingShift = {
  date?: string;
  role?: string;
  slot?: number;
  personId?: number | null;
  startTime?: string | null;
  clockOut?: string | null;
};

function isScheduleDate(iso: string): boolean {
  const day = fromISO(iso).getDay();
  return day === 5 || day === 6;
}

function errorResponse(error: unknown) {
  return NextResponse.json(
    { error: serverErrorMessage(error) },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const weekStart = normalizeWeekStart(
      request.nextUrl.searchParams.get("week"),
    );
    const friday = weekStart;
    const saturday = addDays(friday, 1);
    const supabase = getSupabase();

    const [peopleResult, availabilityResult, shiftsResult] = await Promise.all([
      supabase.from("people").select("id,name").order("name", { ascending: true }),
      supabase
        .from("availability")
        .select("person_id,date,available,preferred_start")
        .in("date", [friday, saturday]),
      supabase
        .from("shifts")
        .select("date,role,slot,person_id,start_time,clock_out")
        .in("date", [friday, saturday]),
    ]);

    if (peopleResult.error) throw peopleResult.error;
    if (availabilityResult.error) throw availabilityResult.error;
    if (shiftsResult.error) throw shiftsResult.error;

    return NextResponse.json({
      weekStart,
      friday,
      saturday,
      people: (peopleResult.data ?? []).map(mapPerson),
      availability: (availabilityResult.data ?? []).map(mapAvailability),
      shifts: (shiftsResult.data ?? []).map(mapShift),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const incoming: IncomingShift[] = Array.isArray(body.shifts)
      ? body.shifts
      : [];

    const rows: Shift[] = [];
    const dates = new Set<string>();

    for (const item of incoming) {
      if (
        typeof item.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
        !isScheduleDate(item.date)
      ) {
        continue;
      }

      const role = ROLE_BY_KEY.get(String(item.role));
      const slot = Number(item.slot);
      if (!role || !Number.isInteger(slot) || slot < 0 || slot >= role.slots) {
        continue;
      }

      const parsedPersonId =
        item.personId === null || item.personId === undefined
          ? null
          : Number(item.personId);
      const personId =
        parsedPersonId !== null &&
        Number.isFinite(parsedPersonId) &&
        parsedPersonId > 0
          ? parsedPersonId
          : null;

      const startTime =
        personId === null ? null : normalizeTime(item.startTime);
      rows.push({
        date: item.date,
        role: role.key,
        slot,
        personId,
        startTime,
        clockOut: startTime ? normalizeTime(item.clockOut) : null,
      });
      dates.add(item.date);
    }

    if (!rows.length) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabase();
    const payload = rows.map((row) => ({
      date: row.date,
      role: row.role,
      slot: row.slot,
      person_id: row.personId,
      start_time: row.startTime,
      clock_out: row.clockOut,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("shifts")
      .upsert(payload, { onConflict: "date,role,slot" });
    if (error) throw error;

    const dateList = Array.from(dates);
    await supabase
      .from("shifts")
      .delete()
      .in("date", dateList)
      .is("person_id", null)
      .is("start_time", null)
      .is("clock_out", null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
