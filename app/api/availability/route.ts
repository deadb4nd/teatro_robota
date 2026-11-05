import { NextRequest, NextResponse } from "next/server";
import { fromISO, normalizeTime } from "@/lib/dates";
import { serverErrorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";

type IncomingEntry = {
  personId?: number | null;
  date?: string;
  available?: boolean;
  preferredStart?: string | null;
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const incoming: IncomingEntry[] = Array.isArray(body.entries)
      ? body.entries
      : [];
    const dates: string[] = Array.isArray(body.dates)
      ? body.dates.filter(
          (date: unknown): date is string =>
            typeof date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(date) &&
            isScheduleDate(date),
        )
      : [];

    const allowedDates = new Set(dates);
    const now = new Date().toISOString();
    const payload: Array<{
      person_id: number;
      date: string;
      available: boolean;
      preferred_start: string | null;
      updated_at: string;
    }> = [];

    for (const entry of incoming) {
      const personId = Number(entry.personId);
      if (!Number.isFinite(personId) || personId <= 0) continue;
      if (typeof entry.date !== "string" || !allowedDates.has(entry.date)) {
        continue;
      }

      payload.push({
        person_id: personId,
        date: entry.date,
        available: Boolean(entry.available),
        preferred_start: Boolean(entry.available)
          ? normalizeTime(entry.preferredStart)
          : null,
        updated_at: now,
      });
    }

    if (!payload.length) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("availability")
      .upsert(payload, { onConflict: "person_id,date" });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
