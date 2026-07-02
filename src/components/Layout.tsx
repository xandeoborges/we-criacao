import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Rows3, RefreshCw, Menu, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTaskrowData } from '@/hooks/useTaskrowData';

const NAV = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/swimlane', label: 'Tarefas', icon: Rows3 },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { dataUpdatedAt } = useTaskrowData();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-[hsl(240_20%_7%)] border-b border-[hsl(var(--border))]">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">WE Agência</p>
          <h1 className="text-sm font-bold text-foreground">Criação</h1>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors"
          aria-label="Abrir menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-56 flex-shrink-0 flex flex-col bg-[hsl(240_20%_7%)] border-r border-[hsl(var(--border))] fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[hsl(var(--border))]">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">WE Agência</p>
          <h1 className="text-base font-bold text-foreground mt-0.5">Criação</h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[hsl(244_94%_69%/0.15)] text-primary border border-[hsl(244_94%_69%/0.3)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.04)]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[hsl(var(--border))] space-y-1.5">
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['taskrow'] })}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <RefreshCw size={13} />
            Atualizar dados
          </button>
          {dataUpdatedAt > 0 && (
            <p className="text-[11px] text-muted-foreground/60 pl-[21px]">
              Última atualização às{' '}
              {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
