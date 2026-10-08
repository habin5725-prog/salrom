export function Loading({ label = "불러오는 중입니다" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-accent" />
      <span className="text-base">{label}</span>
    </div>
  );
}
