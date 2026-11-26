export type Role = "admin" | "leader" | "member";
export type TaskStatus = "open" | "completed" | "cancelled";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  team_id: string | null;
  active: boolean;
  email_notifications: boolean;
}

export interface Task {
  id: string;
  recurring_id: string | null;
  period_key: string | null;
  title: string;
  description: string;
  category: string;
  assignee_id: string;
  created_by: string;
  due_date: string;
  original_due_date: string;
  visible_from: string;
  status: TaskStatus;
  completed_at: string | null;
  completed_on: string | null;
  created_at: string;
}

export interface RecurringTask {
  id: string;
  title: string;
  description: string;
  category: string;
  assignee_id: string;
  created_by: string;
  frequency: "weekly" | "monthly" | "quarterly" | "half_yearly";
  rule: "working_day" | "calendar_day" | "last_working_day";
  rule_value: number;
  period_month: number;
  lead_days: number;
  start_date: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  actor_id: string | null;
  kind: string;
  body: string;
  created_at: string;
}

export interface DeadlineRequest {
  id: string;
  task_id: string;
  requested_by: string;
  current_due: string;
  proposed_due: string;
  reason: string;
  status: RequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface Transfer {
  id: string;
  task_id: string;
  from_user: string;
  to_user: string;
  note: string;
  status: RequestStatus;
  responded_at: string | null;
  created_at: string;
}

export interface Holiday {
  id: string;
  holiday_date: string;
  name: string;
  source: string;
  is_active: boolean;
  locked: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
}

export const isLeader = (p: Pick<Profile, "role">) => p.role === "leader" || p.role === "admin";
