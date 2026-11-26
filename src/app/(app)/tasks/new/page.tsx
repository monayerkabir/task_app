import { requireLeader, teamMembers } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { db } from "@/lib/supabase/server";
import { NewTaskForm } from "@/components/new-task-form";

export const metadata = { title: "Assign task" };

export default async function NewTask() {
  const user = await requireLeader();
  const team = await teamMembers(user);
  const { data: cats } = await db().from("tasks").select("category").limit(500);
  const categories = [...new Set(["General", "Credit Review", "Portfolio Monitoring", "MIS Report", "Regulatory Return", ...(cats ?? []).map((c: { category: string }) => c.category)])];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="h1">Assign a task</h1>
      <NewTaskForm people={team.map((p) => ({ id: p.id, full_name: p.full_name }))} categories={categories} today={todayInDhaka()} />
    </div>
  );
}
