// Minimal iCalendar parser for all-day holiday feeds (e.g. Google's public
// "Holidays in Bangladesh" calendar).

export interface IcsHoliday {
  date: string; // YYYY-MM-DD
  endExclusive: string | null;
  name: string;
  /** true for gazetted public holidays, false for observances */
  isPublic: boolean;
}

function unfold(text: string): string[] {
  // RFC 5545: lines starting with a space or tab continue the previous line
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescape(v: string) {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

function toISO(v: string): string | null {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function parseIcsHolidays(text: string): IcsHoliday[] {
  const out: IcsHoliday[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur) {
        const date = toISO(cur.DTSTART ?? "");
        if (date && cur.SUMMARY) {
          const desc = (cur.DESCRIPTION ?? "").toLowerCase();
          out.push({
            date,
            endExclusive: cur.DTEND ? toISO(cur.DTEND) : null,
            name: unescape(cur.SUMMARY),
            isPublic: !desc.includes("observance"),
          });
        }
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).split(";")[0].toUpperCase();
      cur[key] = line.slice(idx + 1);
    }
  }
  return out;
}
