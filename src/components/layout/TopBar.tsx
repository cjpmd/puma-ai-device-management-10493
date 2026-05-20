import React from 'react';
import { Link } from 'react-router-dom';

interface TopBarProps {
  orgName?: string;
  userName?: string;
  userRole?: string;
  fcUrl?: string;
}

export function TopBar({ orgName, userName, userRole, fcUrl }: TopBarProps) {
  const clubHref = fcUrl ||
    (typeof window !== 'undefined' ? localStorage.getItem('origin_sports_fc_url') || '' : '');

  return (
    <header className="flex items-center gap-4 h-14 px-6 bg-white border-b border-slate-200 flex-shrink-0">
      {/* Home — back to Origin Sports Performance landing */}
      <Link
        to="/"
        className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-violet-700 font-medium transition-colors"
        title="Origin Sports Performance Home"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        Home
      </Link>

      {/* Org name */}
      <div className="flex-1 min-w-0 pl-2 border-l border-slate-200">
        {orgName && (
          <span className="text-sm font-semibold text-slate-800 truncate">{orgName}</span>
        )}
      </div>

      {/* Club website link (configured in Settings → Academy Profile) */}
      {clubHref && (
        <a
          href={clubHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
          Club website
        </a>
      )}

      {/* User info */}
      {(userName || userRole) && (
        <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-semibold text-violet-700">
            {userName ? userName.slice(0, 2).toUpperCase() : 'U'}
          </div>
          <div className="hidden sm:block">
            {userName && <div className="text-xs font-medium text-slate-700 leading-none">{userName}</div>}
            {userRole && <div className="text-[10px] text-slate-400 mt-0.5 capitalize">{userRole}</div>}
          </div>
        </div>
      )}
    </header>
  );
}
