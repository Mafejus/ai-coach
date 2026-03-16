export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
