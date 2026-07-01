export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-10">
        <p className="mb-6 text-center text-lg font-semibold text-slate-900">EchoType</p>
        <div className="rounded-lg border bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
