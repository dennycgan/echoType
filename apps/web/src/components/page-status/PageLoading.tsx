export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="text-sm text-slate-500" data-testid="page-loading" aria-live="polite">
      {label}
    </p>
  );
}
