import React, { useState, useEffect, useRef } from 'react';
import { useActiveContext, type ActiveContext, type ContextKind } from '@/contexts/ActiveContextContext';

// ─── Kind metadata ────────────────────────────────────────────────────────────

const KIND_LABEL: Record<ContextKind, string> = {
  academy: 'Academy',
  club: 'Club',
  team: 'Team',
};

const KIND_BADGE: Record<ContextKind, string> = {
  academy: 'bg-violet-100 text-violet-700',
  club:    'bg-sky-100 text-sky-700',
  team:    'bg-emerald-100 text-emerald-700',
};

const KIND_INITIALS: Record<ContextKind, string> = {
  academy: 'AC',
  club:    'CL',
  team:    'TM',
};

// ─── Grouped list helper ─────────────────────────────────────────────────────

const KIND_ORDER: ContextKind[] = ['academy', 'club', 'team'];

function groupContexts(list: ActiveContext[]): Array<{ kind: ContextKind; items: ActiveContext[] }> {
  return KIND_ORDER
    .map(kind => ({ kind, items: list.filter(c => c.kind === kind) }))
    .filter(g => g.items.length > 0);
}

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ContextSwitcherProps {
  collapsed?: boolean;
}

export function ContextSwitcher({ collapsed = false }: ContextSwitcherProps) {
  const { activeContext, availableContexts, setActiveContext } = useActiveContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const canSwitch = availableContexts.length > 1;
  const groups = groupContexts(availableContexts);

  if (!activeContext) {
    return (
      <div className="px-4 py-4 border-b border-white/10">
        <div className="h-8 w-8 rounded-lg bg-slate-700 animate-pulse" />
      </div>
    );
  }

  function handleSelect(ctx: ActiveContext) {
    setActiveContext(ctx);
    setOpen(false);
  }

  const initials = activeContext.label
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || KIND_INITIALS[activeContext.kind];

  return (
    <div ref={ref} className="relative px-4 py-4 border-b border-white/10">
      {/* Badge / trigger */}
      <button
        onClick={() => canSwitch && setOpen(o => !o)}
        disabled={!canSwitch}
        className={`flex items-center gap-3 w-full text-left transition-colors rounded-lg
          ${canSwitch ? 'hover:bg-white/10 cursor-pointer -mx-2 px-2 py-1' : 'cursor-default'}`}
        aria-expanded={open}
        aria-haspopup={canSwitch ? 'listbox' : undefined}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
          {initials}
        </div>

        {/* Labels — hidden when sidebar collapsed */}
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{activeContext.label}</div>
            <div className="text-[10px] text-white/50 mt-0.5">{KIND_LABEL[activeContext.kind]}</div>
          </div>
        )}

        {/* Chevron */}
        {canSwitch && !collapsed && (
          <span className={`text-white/40 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
            <ChevronDown />
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute left-4 top-full mt-1 z-50 w-56 bg-slate-800 border border-white/10
                     rounded-xl shadow-2xl overflow-hidden"
          role="listbox"
          aria-label="Switch context"
        >
          <div className="px-3 pt-2.5 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Switch context
            </span>
          </div>

          {groups.map(group => (
            <div key={group.kind}>
              {/* Group header — only shown when multiple kinds exist */}
              {groups.length > 1 && (
                <div className="px-3 pt-2 pb-0.5">
                  <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
                    {KIND_LABEL[group.kind]}
                  </span>
                </div>
              )}

              {group.items.map(ctx => {
                const isActive = ctx.kind === activeContext.kind && ctx.id === activeContext.id;
                return (
                  <button
                    key={`${ctx.kind}-${ctx.id}`}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(ctx)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors
                      ${isActive
                        ? 'bg-violet-600/30 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                  >
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded
                      ${KIND_BADGE[ctx.kind]}`}>
                      {KIND_LABEL[ctx.kind]}
                    </span>
                    <span className="text-sm flex-1 truncate">{ctx.label}</span>
                    {isActive && (
                      <span className="text-violet-400 flex-shrink-0">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="h-1.5" />
        </div>
      )}
    </div>
  );
}
