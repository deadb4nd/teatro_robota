import { NextRequest, NextResponse } from "next/server";
import { addDays, normalizeMonth, monthFridays } from "@/lib/dates";
import { serverErrorMessage } from "@/lib/errors";
import { minutesBetween } from "@/lib/hours";
import { mapPerson, mapShift } from "@/lib/mappers";
import { ROLES } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import type {
  DaySummary,
  MonthData,
  PersonMonthTotal,
  ShiftWithPerson,
  WeekSummary,
} from "@/lib/types";

const ROLE_ORDER = new Map(ROLES.map((role, index) => [role.key, index]));

function errorResponse(error: unknown) {
  return NextResponse.json(
    { error: serverErrorMessage(error) },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const month = normalizeMonth(request.nextUrl.searchParams.get("month"));
    const fridays = monthFridays(month);
    const dates = fridays.flatMap((friday) => [friday, addDays(friday, 1)]);
    const supabase = getSupabase();

    const [peopleResult, shiftsResult] = await Promise.all([
      supabase.from("people").select("id,name").order("name", { ascending: true }),
      dates.length
        ? supabase
            .from("shifts")
            .select("date,role,slot,person_id,start_time,clock_out")
            .in("date", dates)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (peopleResult.error) throw peopleResult.error;
    if (shiftsResult.error) throw shiftsResult.error;

    const people = (peopleResult.data ?? []).map(mapPerson);
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const shifts = (shiftsResult.data ?? []).map(mapShift);

    const totals = new Map<number, PersonMonthTotal>(
      people.map((person) => [
        person.id,
        {
          personId: person.id,
          name: person.name,
          shifts: 0,
          workedShifts: 0,
          workedMinutes: 0,
          missingClockOut: 0,
        },
      ]),
    );

    const weeks: WeekSummary[] = fridays.map((friday) => {
      const saturday = addDays(friday, 1);
      const days: DaySummary[] = [friday, saturday].map((date) => {
        const shiftsForDay: ShiftWithPerson[] = shifts
          .filter(
            (shift) =>
              shift.date === date &&
              shift.personId !== null &&
              peopleById.has(shift.personId),
          )
          .sort((a, b) => {
            const roleDiff =
              (ROLE_ORDER.get(a.role) ?? 99) - (ROLE_ORDER.get(b.role) ?? 99);
            return roleDiff || a.slot - b.slot;
          })
          .map((shift) => {
            const minutes = minutesBetween(shift.startTime, shift.clockOut);
            return {
              ...shift,
              personName: peopleById.get(shift.personId as number)?.name ?? "",
              minutes,
            };
          });

        let totalMinutes = 0;
        const totalShifts = shiftsForDay.length;
        let missingClockOut = 0;

        for (const shift of shiftsForDay) {
          if (shift.minutes !== null) {
            totalMinutes += shift.minutes;
          } else if (shift.startTime && !shift.clockOut) {
            missingClockOut += 1;
          }
        }

        return { date, shifts: shiftsForDay, totalMinutes, totalShifts, missingClockOut };
      });

      return {
        friday,
        saturday,
        days,
        totalMinutes: days.reduce((sum, day) => sum + day.totalMinutes, 0),
        totalShifts: days.reduce((sum, day) => sum + day.totalShifts, 0),
        missingClockOut: days.reduce((sum, day) => sum + day.missingClockOut, 0),
      };
    });

    for (const week of weeks) {
      for (const day of week.days) {
        for (const shift of day.shifts) {
          if (shift.personId === null) continue;
          const personTotal = totals.get(shift.personId);
          if (!personTotal) continue;

          personTotal.shifts += 1;
          if (shift.minutes !== null) {
            personTotal.workedShifts += 1;
            personTotal.workedMinutes += shift.minutes;
          } else if (shift.startTime && !shift.clockOut) {
            personTotal.missingClockOut += 1;
          }
        }
      }
    }

    const data: MonthData = {
      month,
      weeks,
      people: Array.from(totals.values()),
      totalMinutes: weeks.reduce((sum, week) => sum + week.totalMinutes, 0),
      totalShifts: weeks.reduce((sum, week) => sum + week.totalShifts, 0),
      missingClockOut: weeks.reduce(
        (sum, week) => sum + week.missingClockOut,
        0,
      ),
    };

    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
