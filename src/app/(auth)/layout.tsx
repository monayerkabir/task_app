export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-700 text-2xl text-white shadow">✓</div>
          <h1 className="text-2xl font-bold text-slate-900">Tick Analytics</h1>
          <p className="muted">Credit Analytics team tasks</p>
        </div>
        {children}
      </div>
    </div>
  );
}
