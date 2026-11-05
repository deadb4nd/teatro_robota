import { NextRequest, NextResponse } from "next/server";
import { fromISO, normalizeTime } from "@/lib/dates";
import { serverErrorMessage } from "@/lib/errors";
import { ROLE_BY_KEY } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";

type IncomingHours = {
  date?: string;
  role?: string;
  slot?: number;
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const incoming: IncomingHours[] = Array.isArray(body.shifts)
      ? body.shifts
      : [];
    const supabase = getSupabase();

    const updates = incoming.flatMap((item) => {
      if (
        typeof item.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
        !isScheduleDate(item.date) ||
        typeof item.role !== "string"
      ) {
        return [];
      }

      const role = ROLE_BY_KEY.get(item.role);
      if (!role) return [];

      const slot = Number(item.slot);
      if (!Number.isInteger(slot) || slot < 0 || slot >= role.slots) return [];

      return [
        supabase
          .from("shifts")
          .update({
            clock_out: normalizeTime(item.clockOut),
            updated_at: new Date().toISOString(),
          })
          .eq("date", item.date)
          .eq("role", item.role)
          .eq("slot", slot)
          .not("person_id", "is", null)
          .not("start_time", "is", null),
      ];
    });

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
