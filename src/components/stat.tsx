export function Stat({ label, value, tone }: { label: string; value: number | string; tone: "red" | "amber" | "green" | "slate" | "sky" }) {
  const c = {
    red: "text-red-700",
    amber: "text-amber-700",
    green: "text-emerald-700",
    slate: "text-slate-800",
    sky: "text-sky-700",
  }[tone];
  return (
    <div className="card p-3">
      <p className={`text-2xl font-bold ${c}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
