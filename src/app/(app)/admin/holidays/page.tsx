import { saveHoliday } from "@/app/actions/admin";
import { formatShort, todayInDhaka } from "@/lib/dates";
import { db } from "@/lib/supabase/server";
import { Holiday } from "@/lib/types";
import { ActionForm, Submit } from "@/components/forms";
import { HolidayRow, SyncButton } from "@/components/holiday-controls";

export const metadata = { title: "Holidays" };

export default async function HolidaysPage({ searchParams }: PageProps<"/admin/holidays">) {
  const sp = await searchParams;
  const year = Number(sp.year) || Number(todayInDhaka().slice(0, 4));
  const { data } = await db()
    .from("holidays")
    .select("*")
    .gte("holiday_date", `${year}-01-01`)
    .lte("holiday_date", `${year}-12-31`)
    .order("holiday_date");
  const list = (data ?? []) as Holiday[];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Government holidays {year}</h1>
        <p className="muted">
          Fridays and Saturdays are always off. Days below are also skipped when counting working days. They sync every Sunday from the public
          Bangladesh holiday calendar (Google). Islamic holidays depend on moon sighting, so check them against the Ministry of Public
          Administration circular and adjust here; your edits are never overwritten.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <SyncButton />
        <a className="btn-secondary" href={`/admin/holidays?year=${year - 1}`}>
          ‹ {year - 1}
        </a>
        <a className="btn-secondary" href={`/admin/holidays?year=${year + 1}`}>
          {year + 1} ›
        </a>
        <a className="btn-secondary" href="https://mopa.gov.bd" target="_blank" rel="noreferrer">
          Official circulars ↗
        </a>
      </div>
      <ActionForm action={saveHoliday} className="card grid gap-2 sm:grid-cols-[auto_1fr_auto]" resetOnSuccess>
        <input type="date" name="holiday_date" className="input" required />
        <input name="name" className="input" placeholder="Holiday name, e.g. Executive order holiday" required />
        <Submit>Add holiday</Submit>
      </ActionForm>
      <div className="card divide-y divide-slate-100 p-0">
        {list.length === 0 && <p className="muted p-4">No holidays for {year} yet. Press “Sync now”.</p>}
        {list.map((h) => (
          <HolidayRow key={h.id} h={{ ...h, label: formatShort(h.holiday_date) }} />
        ))}
      </div>
    </div>
  );
}
