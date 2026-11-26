import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkCalendar, addDays, todayInDhaka } from "../src/lib/dates";
import { occurrencesBetween, dueDateForPeriodKey, describeRecurrence, RecurrenceSpec } from "../src/lib/recurrence";
import { parseIcsHolidays } from "../src/lib/ics";

// Dec 2026: 1st is a Tuesday. Fri/Sat weekend. 16 Dec = Victory Day (Wed).
const cal = new WorkCalendar(["2026-12-16", "2026-12-25"]);

const base: RecurrenceSpec = {
  frequency: "monthly",
  rule: "working_day",
  rule_value: 1,
  period_month: 1,
  start_date: "2026-01-01",
  end_date: null,
};

test("weekend is Friday and Saturday", () => {
  assert.equal(cal.isWorkingDay("2026-12-04"), false); // Fri
  assert.equal(cal.isWorkingDay("2026-12-05"), false); // Sat
  assert.equal(cal.isWorkingDay("2026-12-06"), true); // Sun
  assert.equal(cal.isWorkingDay("2026-12-16"), false); // holiday
});

test("Nth working day of month skips weekends and holidays", () => {
  const occ = occurrencesBetween({ ...base, rule_value: 5 }, cal, "2026-12-01", "2026-12-31");
  // Dec: 1 Tue,2 Wed,3 Thu,(4,5 weekend),6 Sun,7 Mon -> 5th working day = 7th
  assert.deepEqual(occ, [{ periodKey: "2026-12", dueDate: "2026-12-07" }]);
  const occ12 = occurrencesBetween({ ...base, rule_value: 12 }, cal, "2026-12-01", "2026-12-31");
  // 8 Tue,9 Wed,10 Thu,13 Sun,14 Mon,15 Tue,(16 holiday),17 Thu -> 12th = 17th
  assert.equal(occ12[0].dueDate, "2026-12-17");
});

test("fixed calendar day on a holiday moves to the working day before", () => {
  const occ = occurrencesBetween({ ...base, rule: "calendar_day", rule_value: 16 }, cal, "2026-12-01", "2026-12-31");
  assert.equal(occ[0].dueDate, "2026-12-15");
  // 5 Dec 2026 is a Saturday -> Thursday 3rd
  const sat = occurrencesBetween({ ...base, rule: "calendar_day", rule_value: 5 }, cal, "2026-12-01", "2026-12-31");
  assert.equal(sat[0].dueDate, "2026-12-03");
  // 31st in a 30-day month clamps to 30th
  const nov = occurrencesBetween({ ...base, rule: "calendar_day", rule_value: 31 }, cal, "2026-11-01", "2026-11-30");
  assert.equal(nov[0].dueDate, "2026-11-30"); // Monday
});

test("last working day of month", () => {
  const occ = occurrencesBetween({ ...base, rule: "last_working_day" }, cal, "2026-12-01", "2026-12-31");
  assert.equal(occ[0].dueDate, "2026-12-31"); // Thursday
  const jan = occurrencesBetween({ ...base, rule: "last_working_day" }, cal, "2027-01-01", "2027-01-31");
  assert.equal(jan[0].dueDate, "2027-01-31"); // 29 Fri, 30 Sat, 31 Sun
});

test("quarterly uses month inside the quarter", () => {
  const spec: RecurrenceSpec = { ...base, frequency: "quarterly", rule: "working_day", rule_value: 1, period_month: 1 };
  const occ = occurrencesBetween(spec, cal, "2026-01-01", "2026-12-31");
  assert.deepEqual(occ.map((o) => o.periodKey), ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]);
  assert.equal(occ[3].dueDate, "2026-10-01"); // Thu 1 Oct 2026
  const third = occurrencesBetween({ ...spec, period_month: 3, rule: "last_working_day" }, cal, "2026-10-01", "2026-12-31");
  assert.equal(third[0].dueDate, "2026-12-31");
});

test("half-yearly", () => {
  const spec: RecurrenceSpec = { ...base, frequency: "half_yearly", rule: "calendar_day", rule_value: 15, period_month: 1 };
  const occ = occurrencesBetween(spec, cal, "2026-01-01", "2026-12-31");
  assert.deepEqual(occ.map((o) => o.periodKey), ["2026-H1", "2026-H2"]);
  assert.equal(occ[1].dueDate, "2026-07-15");
});

test("weekly on a weekday, and Nth working day of week", () => {
  const spec: RecurrenceSpec = { ...base, frequency: "weekly", rule: "calendar_day", rule_value: 3 }; // Wednesday
  const occ = occurrencesBetween(spec, cal, "2026-12-13", "2026-12-26");
  // Wed 16 Dec is a holiday -> Tue 15 Dec; Wed 23 Dec
  assert.deepEqual(occ.map((o) => o.dueDate), ["2026-12-15", "2026-12-23"]);
  const nth = occurrencesBetween({ ...spec, rule: "working_day", rule_value: 1 }, cal, "2026-12-06", "2026-12-12");
  assert.deepEqual(nth, [{ periodKey: "W2026-12-06", dueDate: "2026-12-06" }]);
  const last = occurrencesBetween({ ...spec, rule: "last_working_day" }, cal, "2026-12-20", "2026-12-26");
  assert.equal(last[0].dueDate, "2026-12-24"); // Thu (25th is holiday + Fri anyway)
});

test("start and end dates are respected", () => {
  const occ = occurrencesBetween({ ...base, start_date: "2026-11-15", end_date: "2027-01-31" }, cal, "2026-10-01", "2027-03-31");
  assert.deepEqual(occ.map((o) => o.periodKey), ["2026-12", "2027-01"]);
});

test("holiday shift can pull a due date into the previous period and is still found", () => {
  // 1st working day of a week can't be earlier than the week, but calendar day 1 of month on a weekend moves back
  const c = new WorkCalendar([]);
  // 1 Aug 2026 is Saturday -> moves to Thu 30 Jul
  const occ = occurrencesBetween({ ...base, rule: "calendar_day", rule_value: 1 }, c, "2026-07-29", "2026-07-31");
  assert.deepEqual(occ, [{ periodKey: "2026-08", dueDate: "2026-07-30" }]);
});

test("due date for a period key", () => {
  assert.equal(dueDateForPeriodKey({ ...base, rule_value: 5 }, "2026-12", cal), "2026-12-07");
  assert.equal(dueDateForPeriodKey({ ...base, frequency: "quarterly" }, "2026-Q4", cal), "2026-10-01");
});

test("lead days count working days back", () => {
  // due Mon 7 Dec, 3 working days earlier: Sun 6, Thu 3, Wed 2 -> Wed 2 Dec
  assert.equal(cal.subtractWorkingDays("2026-12-07", 3), "2026-12-02");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("today in Dhaka", () => {
  // 20:00 UTC is 02:00 next day in Dhaka
  assert.equal(todayInDhaka(new Date("2026-11-26T20:00:00Z")), "2026-11-27");
});

test("describe", () => {
  assert.equal(describeRecurrence({ ...base, rule_value: 5 }), "Monthly, 5th working day of the month");
  assert.equal(
    describeRecurrence({ frequency: "weekly", rule: "calendar_day", rule_value: 0, period_month: 1 }),
    "Weekly, every Sunday",
  );
});

test("ICS parser", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261216",
    "DTEND;VALUE=DATE:20261217",
    "SUMMARY:Victory Day",
    "DESCRIPTION:Public holiday",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261214",
    "SUMMARY:Martyred Intellectuals",
    "  Day",
    "DESCRIPTION:Observance\\nTo hide observances\\, go to Google Calendar Settings",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const h = parseIcsHolidays(ics);
  assert.equal(h.length, 2);
  assert.deepEqual(h[0], { date: "2026-12-16", endExclusive: "2026-12-17", name: "Victory Day", isPublic: true });
  assert.equal(h[1].name, "Martyred Intellectuals Day");
  assert.equal(h[1].isPublic, false);
});
