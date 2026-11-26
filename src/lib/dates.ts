// Pure date helpers. Dates are plain "YYYY-MM-DD" strings (Bangladesh local dates)
// and all arithmetic is done in UTC so there are no timezone surprises.

export type ISODate = string;

export const TIME_ZONE = "Asia/Dhaka";

/** Friday (5) and Saturday (6) are the weekend in Bangladesh. */
export const WEEKEND_DAYS = [5, 6];

export function todayInDhaka(now: Date = new Date()): ISODate {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parse(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function fmt(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
}

export function weekday(d: ISODate): number {
  return parse(d).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  // month is 1-12
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function ymd(year: number, month: number, day: number): ISODate {
  return fmt(new Date(Date.UTC(year, month - 1, day)));
}

export class WorkCalendar {
  private holidays: Set<string>;
  constructor(holidays: Iterable<ISODate>) {
    this.holidays = new Set(holidays);
  }

  isHoliday(d: ISODate) {
    return this.holidays.has(d);
  }

  isWorkingDay(d: ISODate) {
    return !WEEKEND_DAYS.includes(weekday(d)) && !this.holidays.has(d);
  }

  /** The date itself if it is a working day, otherwise the closest working day before it. */
  onOrBefore(d: ISODate): ISODate {
    let x = d;
    for (let i = 0; i < 60 && !this.isWorkingDay(x); i++) x = addDays(x, -1);
    return x;
  }

  onOrAfter(d: ISODate): ISODate {
    let x = d;
    for (let i = 0; i < 60 && !this.isWorkingDay(x); i++) x = addDays(x, 1);
    return x;
  }

  /** Move back n working days (n = 0 returns the date unchanged). */
  subtractWorkingDays(d: ISODate, n: number): ISODate {
    let x = d;
    let left = n;
    while (left > 0) {
      x = addDays(x, -1);
      if (this.isWorkingDay(x)) left--;
    }
    return x;
  }

  /** Working days in [from, to], inclusive. */
  workingDaysBetween(from: ISODate, to: ISODate): ISODate[] {
    const out: ISODate[] = [];
    for (let x = from; x <= to; x = addDays(x, 1)) if (this.isWorkingDay(x)) out.push(x);
    return out;
  }
}

export function formatDate(d: ISODate | null | undefined): string {
  if (!d) return "";
  return parse(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShort(d: ISODate): string {
  return parse(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
