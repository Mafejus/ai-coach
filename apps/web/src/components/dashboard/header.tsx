export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-3 md:hidden">
        <span className="text-lg font-bold text-foreground">🏋️ AI Coach</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
          U
        </div>
      </div>
    </header>
  );
}
