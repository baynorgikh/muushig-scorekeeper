import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, History, Home, PlusCircle, Settings, Users, WifiOff, CloudUpload } from 'lucide-react';
import { Toasts } from './ui';
import { useUi } from '../stores/uiStore';

export const NAV = [
  { to: '/', label: 'Нүүр', icon: Home, end: true },
  { to: '/new', label: 'Шинэ тоглолт', short: 'Шинэ', icon: PlusCircle },
  { to: '/players', label: 'Тоглогчид', icon: Users },
  { to: '/history', label: 'Тоглолтын түүх', short: 'Түүх', icon: History },
  { to: '/stats', label: 'Статистик', icon: BarChart3 },
  { to: '/settings', label: 'Тохиргоо', icon: Settings },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-9 w-7">
        <div className="absolute inset-0 rotate-[-10deg] rounded-md border border-gold-500/60 bg-ink-800" />
        <div className="absolute inset-0 flex rotate-[6deg] items-center justify-center rounded-md border border-gold-400 bg-gradient-to-br from-felt-600 to-felt-900 text-sm text-gold-400">♠</div>
      </div>
      <div className="leading-tight">
        <div className="font-display text-lg font-bold text-gold-400">Муушиг</div>
        <div className="text-[11px] uppercase tracking-widest text-ink-400">Оноо бүртгэгч</div>
      </div>
    </div>
  );
}

function SyncBadge() {
  const online = useUi((s) => s.online);
  const pending = useUi((s) => s.pendingSync);
  if (online && pending === 0) return null;
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${online ? 'bg-gold-900 text-gold-400' : 'bg-ruby-900 text-ruby-400'}`}>
      {online ? <CloudUpload size={14} /> : <WifiOff size={14} />}
      {online ? `Илгээгдээгүй: ${pending}` : 'Офлайн — өгөгдөл төхөөрөмж дээр хадгалагдана'}
    </div>
  );
}

export function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      <Toasts />
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-ink-700/70 bg-ink-950/60 p-5 md:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${isActive ? 'bg-felt-500/15 text-felt-400 ring-1 ring-felt-500/30' : 'text-ink-300 hover:bg-ink-800 hover:text-white'}`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto text-xs text-ink-400">5 тоглогчийн Монгол хөзөр</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-700/60 bg-ink-900/85 px-4 py-3 backdrop-blur md:hidden">
          <Logo />
          <SyncBadge />
        </header>
        <div className="hidden justify-end px-8 pt-4 md:flex">
          <SyncBadge />
        </div>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-ink-700/70 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ to, label, short, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? 'text-felt-400' : 'text-ink-400'}`}
          >
            <Icon size={22} />
            <span className="truncate">{short ?? label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
