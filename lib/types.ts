export type Person = {
  id: number;
  name: string;
};

export type Availability = {
  personId: number;
  date: string;
  available: boolean;
  preferredStart: string | null;
};

export type Shift = {
  date: string;
  role: string;
  slot: number;
  personId: number | null;
  startTime: string | null;
  clockOut: string | null;
};

export type WeekData = {
  weekStart: string;
  friday: string;
  saturday: string;
  people: Person[];
  availability: Availability[];
  shifts: Shift[];
};

export type ShiftWithPerson = Shift & {
  personName: string;
  minutes: number | null;
};

export type DaySummary = {
  date: string;
  shifts: ShiftWithPerson[];
  totalMinutes: number;
  totalShifts: number;
  missingClockOut: number;
};

export type WeekSummary = {
  friday: string;
  saturday: string;
  days: DaySummary[];
  totalMinutes: number;
  totalShifts: number;
  missingClockOut: number;
};

export type PersonMonthTotal = {
  personId: number;
  name: string;
  shifts: number;
  workedShifts: number;
  workedMinutes: number;
  missingClockOut: number;
};

export type MonthData = {
  month: string;
  weeks: WeekSummary[];
  people: PersonMonthTotal[];
  totalMinutes: number;
  totalShifts: number;
  missingClockOut: number;
};
