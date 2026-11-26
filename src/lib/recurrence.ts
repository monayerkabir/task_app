import {
  addDays,
  daysInMonth,
  ISODate,
  parse,
  weekday,
  WorkCalendar,
  ymd,
} from "./dates";

export type Frequency = "weekly" | "monthly" | "quarterly" | "half_yearly";
export type Rule = "working_day" | "calendar_day" | "last_working_day";

export interface RecurrenceSpec {
  frequency: Frequency;
  rule: Rule;
  rule_value: number;
  period_month: number;
  start_date: ISODate;
  end_date: ISODate | null;
}

export interface Occurrence {
  periodKey: string;
  dueDate: ISODate;
}

interface Period {
  key: string;
  start: ISODate;
  end: ISODate;
  /** month (1-12) and year the rule applies to, for month-based frequencies */
  year?: number;
  month?: number;
}

const MONTHS_PER_PERIOD: Record<Exclude<Frequency, "weekly">, number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
};

/** The period (week, month, quarter or half-year) that contains date d. */
function periodContaining(spec: RecurrenceSpec, d: ISODate): Period {
  if (spec.frequency === "weekly") {
    // Bangladesh work week starts on Sunday
    const start = addDays(d, -weekday(d));
    return { key: `W${start}`, start, end: addDays(start, 6) };
  }
  const size = MONTHS_PER_PERIOD[spec.frequency];
  const x = parse(d);
  const year = x.getUTCFullYear();
  const startMonth = Math.floor(x.getUTCMonth() / size) * size + 1; // 1-based
  const endMonth = startMonth + size - 1;
  const idx = (startMonth - 1) / size + 1;
  const key =
    spec.frequency === "monthly"
      ? `${year}-${String(startMonth).padStart(2, "0")}`
      : spec.frequency === "quarterly"
        ? `${year}-Q${idx}`
        : `${year}-H${idx}`;
  const offset = Math.min(Math.max(spec.period_month, 1), size) - 1;
  return {
    key,
    start: ymd(year, startMonth, 1),
    end: ymd(year, endMonth, daysInMonth(year, endMonth)),
    year,
    month: startMonth + offset,
  };
}

function nextPeriod(spec: RecurrenceSpec, p: Period): Period {
  return periodContaining(spec, addDays(p.end, 1));
}

/** Due date for one period, already moved to a working day (earlier, never later). */
export function dueDateFor(spec: RecurrenceSpec, p: Period, cal: WorkCalendar): ISODate {
  let from: ISODate;
  let to: ISODate;
  if (spec.frequency === "weekly") {
    from = p.start;
    to = p.end;
    if (spec.rule === "calendar_day") {
      const wd = Math.min(Math.max(spec.rule_value, 0), 6);
      return cal.onOrBefore(addDays(p.start, wd));
    }
  } else {
    const y = p.year!;
    const m = p.month!;
    from = ymd(y, m, 1);
    to = ymd(y, m, daysInMonth(y, m));
    if (spec.rule === "calendar_day") {
      const day = Math.min(Math.max(spec.rule_value, 1), daysInMonth(y, m));
      return cal.onOrBefore(ymd(y, m, day));
    }
  }
  const working = cal.workingDaysBetween(from, to);
  if (working.length === 0) return cal.onOrBefore(to);
  if (spec.rule === "last_working_day") return working[working.length - 1];
  const n = Math.max(spec.rule_value, 1);
  return working[Math.min(n, working.length) - 1];
}

/** All occurrences whose due date falls within [from, to]. */
export function occurrencesBetween(
  spec: RecurrenceSpec,
  cal: WorkCalendar,
  from: ISODate,
  to: ISODate,
): Occurrence[] {
  const out: Occurrence[] = [];
  // start one period early: a holiday shift can pull a due date into the previous period
  let p = periodContaining(spec, from);
  p = periodContaining(spec, addDays(p.start, -1));
  // and run one period past the end for the same reason
  const stop = addDays(to, 40);
  for (let i = 0; i < 400 && p.start <= stop; i++, p = nextPeriod(spec, p)) {
    const due = dueDateFor(spec, p, cal);
    if (due < from || due > to) continue;
    if (due < spec.start_date) continue;
    if (spec.end_date && due > spec.end_date) continue;
    out.push({ periodKey: p.key, dueDate: due });
  }
  return out;
}

/** Due date for a specific period key's period, used when holidays change. */
export function dueDateForPeriodKey(
  spec: RecurrenceSpec,
  periodKey: string,
  cal: WorkCalendar,
): ISODate | null {
  let anchor: ISODate | null = null;
  let m: RegExpMatchArray | null;
  if ((m = periodKey.match(/^W(\d{4}-\d{2}-\d{2})$/))) anchor = m[1];
  else if ((m = periodKey.match(/^(\d{4})-(\d{2})$/))) anchor = `${m[1]}-${m[2]}-01`;
  else if ((m = periodKey.match(/^(\d{4})-Q(\d)$/)))
    anchor = ymd(Number(m[1]), (Number(m[2]) - 1) * 3 + 1, 1);
  else if ((m = periodKey.match(/^(\d{4})-H(\d)$/)))
    anchor = ymd(Number(m[1]), (Number(m[2]) - 1) * 6 + 1, 1);
  if (!anchor) return null;
  return dueDateFor(spec, periodContaining(spec, anchor), cal);
}

const ORDINAL = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Human readable schedule, e.g. "Monthly, 5th working day". */
export function describeRecurrence(spec: Pick<RecurrenceSpec, "frequency" | "rule" | "rule_value" | "period_month">): string {
  const freq = {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    half_yearly: "Half-yearly",
  }[spec.frequency];
  const unit = spec.frequency === "weekly" ? "week" : "month";
  let when: string;
  if (spec.rule === "last_working_day") when = `last working day of the ${unit}`;
  else if (spec.rule === "working_day") when = `${ORDINAL(spec.rule_value)} working day of the ${unit}`;
  else if (spec.frequency === "weekly") when = `every ${WEEKDAYS[spec.rule_value] ?? "Sunday"}`;
  else when = `${ORDINAL(spec.rule_value)} of the month`;
  if (spec.frequency === "quarterly") when += `, month ${spec.period_month} of each quarter`;
  if (spec.frequency === "half_yearly") when += `, month ${spec.period_month} of each half-year`;
  return `${freq}, ${when}`;
}
