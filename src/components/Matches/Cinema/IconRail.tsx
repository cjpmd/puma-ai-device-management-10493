import { Film, FileText, BarChart3, Shirt, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CinemaPanel = 'clips' | 'summary' | 'analytics' | 'team';

interface IconRailProps {
  active: CinemaPanel | null;
  onSelect: (panel: CinemaPanel | null) => void;
}

const ITEMS: { key: CinemaPanel; icon: typeof Film; label: string }[] = [
  { key: 'clips',     icon: Film,      label: 'Clips' },
  { key: 'summary',   icon: FileText,  label: 'Summary' },
  { key: 'analytics', icon: BarChart3, label: 'Analytics' },
  { key: 'team',      icon: Shirt,     label: 'Team' },
];

export function IconRail({ active, onSelect }: IconRailProps) {
  return (
    <div className="flex md:flex-col items-center gap-2 p-2 bg-background/40 backdrop-blur-sm border border-border/40 rounded-full md:rounded-2xl">
      {ITEMS.map(({ key, icon: Icon, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(isActive ? null : key)}
            aria-label={label}
            title={label}
            className={cn(
              'relative w-11 h-11 rounded-full flex items-center justify-center transition-all',
              'text-foreground/70 hover:text-foreground hover:bg-foreground/10',
              isActive && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-lg',
            )}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
      {active && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="Close panel"
          className="md:mt-2 w-11 h-11 rounded-full flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-foreground/10"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
