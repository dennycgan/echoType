import { SiteHeader } from '../components/SiteHeader';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-10">
        <div className="rounded-lg border bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
