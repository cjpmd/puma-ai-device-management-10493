import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useOrgType, OrgType } from '@/contexts/OrgTypeContext';
import { ContextSwitcher } from './ContextSwitcher';

interface NavItem {
  label: string;
  path: string;
  tiers: OrgType[];
  icon: React.ReactNode;
}

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard', path: '/dashboard', tiers: ['academy', 'club', 'team'],
    icon: <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  },
  {
    label: 'Players', path: '/players', tiers: ['academy', 'club', 'team'],
    icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
  },
  {
    label: 'Squads', path: '/squads', tiers: ['academy'],
    icon: <Icon d="M3 6h18M3 12h18M3 18h18" />,
  },
  {
    label: 'Development', path: '/development', tiers: ['academy'],
    icon: <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  },
  {
    label: 'Medical', path: '/medical', tiers: ['academy', 'club'],
    icon: <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  },
  {
    label: 'Welfare', path: '/welfare', tiers: ['academy'],
    icon: <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  },
  {
    label: 'Scouting', path: '/scouting', tiers: ['academy'],
    icon: <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z" />,
  },
  {
    label: 'Coaching', path: '/coaching', tiers: ['academy'],
    icon: <Icon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />,
  },
  {
    label: 'Video', path: '/matches', tiers: ['academy', 'club', 'team'],
    icon: <Icon d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />,
  },
  {
    label: 'Compliance', path: '/compliance', tiers: ['academy'],
    icon: <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  },
  {
    label: 'Travel events', path: '/travel', tiers: ['academy'],
    icon: <Icon d="M22 16.5H2M17 8l5 8.5H2l5-8.5h10zM12 2v3M8 3.5l1.5 2.5M16 3.5l-1.5 2.5" />,
  },
  {
    label: 'Settings', path: '/settings', tiers: ['academy', 'club', 'team'],
    icon: <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />,
  },
];

const TIER_LABEL: Record<OrgType, string> = {
  academy: 'Academy',
  club: 'Club',
  team: 'Team',
};

export function Sidebar() {
  const { orgType } = useOrgType();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const visible = NAV_ITEMS.filter(item => item.tiers.includes(orgType));

  return (
    <aside
      className={`flex flex-col bg-slate-900 text-white transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      } min-h-screen flex-shrink-0`}
    >
      {/* Context switcher (replaces static org badge) */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <ContextSwitcher collapsed={collapsed} />
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex-shrink-0 mr-2 text-white/40 hover:text-white/80 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} />
          </svg>
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {visible.map(item => {
          const active = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-violet-600 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
