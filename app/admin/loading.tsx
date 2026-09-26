export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel h-24" />)}
      </div>
      <div className="adm-skel mt-6 h-10 w-1/3" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="adm-skel h-14" />)}
      </div>
    </div>
  );
}
