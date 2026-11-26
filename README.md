# ✓ Tick Analytics

Task tracker for the Credit Analytics team. Works on phone and desktop (installable as an app), runs free on **Vercel** + **Supabase**.

## What it does

- **My day**: each person opens the app to their overdue, due-today and upcoming tasks, plus anything waiting for them (transfers to accept, approvals).
- **Ad hoc tasks**: a leader assigns a one-off task with a due date.
- **Recurring tasks**: set up once as weekly, monthly, quarterly or half-yearly. They post themselves to the assignee's dashboard *N working days before* the due date (default 3). The due date can be:
  - the *Nth working day* of the month/week (e.g. 5th working day),
  - a *fixed date* (e.g. the 10th) or weekday, or
  - the *last working day*.
  If a date lands on a weekend (Fri/Sat) or a government holiday, it **moves to the working day before**.
- **Team member actions**: mark complete (with remarks), propose a new deadline (the team leader approves or rejects), add remarks, or transfer to a colleague, who must **accept** before it moves.
- **Team dashboard** (leaders): done vs due, on-time rate, open and overdue counts per member and per type of work, for this week, month or quarter, plus the deadline approval queue.
- **Bangladesh holidays**: synced every Sunday from Google's public "Holidays in Bangladesh" calendar. Admins can add executive-order holidays, or switch a day on/off (useful when an Eid date shifts with the moon sighting). Manual edits are never overwritten.
- **Notifications**: in-app alerts, phone/browser push, instant emails for assignments, transfers and deadline decisions, and a morning email digest on working days (8 AM Dhaka).
- **Roles**: Admin (manages people and holidays, plus everything a leader can do), Team leader (assigns tasks, approves deadlines, sees the dashboard), Team member.

## Setup (about 20 minutes, all free)

### 1. Supabase (database and logins)

1. Create a free account at [supabase.com](https://supabase.com) → **New project** (region: Singapore is closest to Dhaka). Save the database password somewhere.
2. Open **SQL Editor** → **New query**, paste everything from [`supabase/schema.sql`](supabase/schema.sql), press **Run**.
3. Open **Project Settings → API Keys** (or **API**). You need three values: the **Project URL**, the **anon / publishable** key, and the **service_role / secret** key.
4. Open **Authentication → Sign In / Providers**, keep **Email** on and turn **off** "Allow new users to sign up" (only admins invite people).

### 2. Vercel (hosting)

1. At [vercel.com](https://vercel.com), sign in with GitHub → **Add New → Project** → import `task_app`.
2. Before deploying, open **Environment Variables** and add the values from [`.env.example`](.env.example):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel address, e.g. `https://tick-analytics.vercel.app` |
   | `CRON_SECRET` | any long random text |
   | `SMTP_*` | see Email below (optional) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | see Phone alerts below (optional) |

3. **Deploy.** Then open the site straight away: the first visit shows **First-time setup**, where you create the admin account (that's you). This also loads the holiday calendar.
4. Go to **Admin → Team members** and invite everyone.

### 3. Email (recommended)

Any SMTP account works. The easiest is Gmail:

1. Turn on 2-Step Verification for the Gmail account, then create an **App password** (Google Account → Security → App passwords).
2. In Vercel set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<the Gmail address>`, `SMTP_PASS=<the 16-letter app password>`, and redeploy.

Without email, invitations still work: the app shows you a one-time link to send on WhatsApp or Teams.

### 4. Phone alerts (optional)

1. On any computer with Node.js run `npx web-push generate-vapid-keys`.
2. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private key in `VAPID_PRIVATE_KEY`, and `mailto:<your email>` in `VAPID_SUBJECT`. Redeploy.
3. Each person opens **Settings** (their name, top right) → **Turn on** phone alerts. On iPhone, first add the site to the Home Screen from Safari's Share menu.

### Daily job

[`vercel.json`](vercel.json) runs `/api/cron/daily` every day at 02:00 UTC (8 AM in Dhaka; on the free plan Vercel may run it any time within that hour). It posts recurring tasks whose time has come, refreshes holidays on Sundays, and sends the morning emails. You can run it yourself from **Vercel → Settings → Cron Jobs → Run**.

## Developing locally

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
npm test                     # working-day and recurrence rules
```

Built with Next.js 16 (App Router, server actions), Tailwind CSS 4 and Supabase. All database access runs on the server with the service key after the app checks the user's role. Row Level Security is on with no policies, so the public key can't read any data directly.

### Where things live

- `src/lib/recurrence.ts`, `src/lib/dates.ts`: working-day calendar and recurring due-date rules (tested in `tests/`)
- `src/lib/scheduler.ts`: posting recurring tasks, holiday sync, daily digest
- `src/app/actions/`: everything a user can do (complete, transfer, approve, invite…)
- `src/app/(app)/`: screens; `src/app/(auth)/`: sign in, set password, first-time setup
