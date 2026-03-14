import Link from 'next/link';
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Activity,
  Heart,
  CalendarDays,
  AlertTriangle,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'AI Chat', icon: MessageSquare },
  { href: '/training', label: 'Trénink', icon: Calendar },
  { href: '/activities', label: 'Aktivity', icon: Activity },
  { href: '/health', label: 'Zdraví', icon: Heart },
  { href: '/calendar', label: 'Kalendář', icon: CalendarDays },
  { href: '/injuries', label: 'Zranění', icon: AlertTriangle },
  { href: '/settings', label: 'Nastavení', icon: Settings },
];

export function Sidebar() {
  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <span className="text-xl font-bold text-foreground">🏋️ AI Coach</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
