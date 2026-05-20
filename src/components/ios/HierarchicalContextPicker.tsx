import React, { useMemo, useState } from 'react';
import { Glass } from '@/components/ios/Glass';
import { Avatar } from '@/components/ios/Avatar';
import { T, tType } from '@/lib/ios-tokens';
import { useActiveContext, type ActiveContext } from '@/contexts/ActiveContextContext';
import { groupContextsByClub, type ClubNode } from '@/lib/groupContexts';

const initialsOf = (name: string) =>
  name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '·';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step =
  | { kind: 'clubs' }
  | { kind: 'club'; clubId: string }
  | { kind: 'academy'; clubId: string; academyId: string };

export function HierarchicalContextPicker({ open, onClose }: Props) {
  const { activeContext, availableContexts, setActiveContext } = useActiveContext();
  const [step, setStep] = useState<Step>({ kind: 'clubs' });

  const clubs = useMemo<ClubNode[]>(
    () => groupContextsByClub(availableContexts),
    [availableContexts],
  );

  if (!open) return null;

  const reset = () => setStep({ kind: 'clubs' });
  const close = () => { reset(); onClose(); };

  const pick = (ctx: ActiveContext) => {
    setActiveContext(ctx);
    close();
  };

  const currentClub = step.kind !== 'clubs'
    ? clubs.find(c => c.clubId === step.clubId) ?? null
    : null;

  let title = 'Select club';
  let onBack: (() => void) | null = null;
  let body: React.ReactNode = null;

  if (step.kind === 'clubs') {
    body = (
      <List>
        {clubs.length === 0 && <Empty>No clubs linked to your account</Empty>}
        {clubs.map(c => {
          const isActive = activeContext?.clubId === c.clubId;
          const sub = `${c.academies.length} academ${c.academies.length === 1 ? 'y' : 'ies'} · ${c.teams.length} team${c.teams.length === 1 ? '' : 's'}`;
          return (
            <Row
              key={c.clubId}
              initials={initialsOf(c.label)}
              hue={220}
              title={c.label}
              subtitle={sub}
              active={isActive}
              onClick={() => {
                if (c.academies.length === 0 && c.teams.length === 1) {
                  pick(c.teams[0]);
                } else {
                  setStep({ kind: 'club', clubId: c.clubId });
                }
              }}
              chevron
            />
          );
        })}
      </List>
    );
  } else if (step.kind === 'club' && currentClub) {
    title = currentClub.label;
    onBack = reset;
    body = (
      <List>
        {currentClub.clubCtx && (
          <Row
            initials={initialsOf(currentClub.label)}
            hue={220}
            title={`Use ${currentClub.label} (Club)`}
            subtitle="Club-level view"
            active={activeContext?.kind === 'club' && activeContext.id === currentClub.clubCtx.id}
            onClick={() => pick(currentClub.clubCtx!)}
          />
        )}
        {currentClub.academies.map(a => (
          <Row
            key={a.id}
            initials="AC"
            hue={270}
            title={a.label}
            subtitle="Academy"
            active={activeContext?.kind === 'academy' && activeContext.id === a.id}
            onClick={() => {
              if (currentClub.teams.length === 0) pick(a);
              else setStep({ kind: 'academy', clubId: currentClub.clubId, academyId: a.id });
            }}
            chevron={currentClub.teams.length > 0}
          />
        ))}
        {currentClub.teams.map(t => (
          <Row
            key={t.id}
            initials={initialsOf(t.label)}
            hue={295}
            title={t.label}
            subtitle="Team"
            active={activeContext?.kind === 'team' && activeContext.id === t.id}
            onClick={() => pick(t)}
          />
        ))}
        {currentClub.academies.length === 0 && currentClub.teams.length === 0 && (
          <Empty>No academies or teams in this club yet</Empty>
        )}
      </List>
    );
  } else if (step.kind === 'academy' && currentClub) {
    const academy = currentClub.academies.find(a => a.id === step.academyId);
    title = academy?.label ?? 'Academy';
    onBack = () => setStep({ kind: 'club', clubId: currentClub.clubId });
    body = (
      <List>
        {academy && (
          <Row
            initials="AC"
            hue={270}
            title={`Use ${academy.label}`}
            subtitle="Academy-level view"
            active={activeContext?.kind === 'academy' && activeContext.id === academy.id}
            onClick={() => pick(academy)}
          />
        )}
        {currentClub.teams.map(t => (
          <Row
            key={t.id}
            initials={initialsOf(t.label)}
            hue={295}
            title={t.label}
            subtitle="Team"
            active={activeContext?.kind === 'team' && activeContext.id === t.id}
            onClick={() => pick(t)}
          />
        ))}
        {currentClub.teams.length === 0 && <Empty>No teams in this club yet</Empty>}
      </List>
    );
  }

  return (
    <div
      onClick={close}
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', padding: 16 }}>
        <Glass r={24}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, minHeight: 22 }}>
              {onBack ? (
                <button
                  onClick={onBack}
                  style={{
                    background: 'transparent', border: 'none',
                    color: T.purple[300], ...tType('subhead'),
                    fontWeight: 600, cursor: 'pointer', padding: 0,
                  }}
                >
                  ‹ Back
                </button>
              ) : <span />}
              <div style={{ flex: 1, textAlign: 'center', ...tType('caption1'), color: T.fg2, textTransform: 'uppercase', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px' }}>
                {title}
              </div>
              <span style={{ width: 40 }} />
            </div>
            {body}
            <button
              onClick={close}
              style={{
                width: '100%', marginTop: 12, padding: '12px',
                background: 'rgba(255,255,255,0.08)',
                border: 'none', borderRadius: 12,
                color: T.fg, ...tType('headline'), cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </Glass>
      </div>
    </div>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ ...tType('footnote'), color: T.fg2, textAlign: 'center', padding: '14px 6px' }}>{children}</div>;
}

function Row({
  initials, hue, title, subtitle, active, onClick, chevron,
}: {
  initials: string; hue: number; title: string; subtitle?: string;
  active?: boolean; onClick: () => void; chevron?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 12,
        background: active ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.04)',
        border: '0.5px solid ' + (active ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.08)'),
        cursor: 'pointer', textAlign: 'left', color: T.fg, width: '100%',
      }}
    >
      <Avatar initials={initials} size={36} hue={hue} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ ...tType('caption2'), color: T.fg2 }}>{subtitle}</div>
        )}
      </div>
      {active && <div style={{ color: T.purple[300], fontSize: 18 }}>✓</div>}
      {!active && chevron && <div style={{ color: T.fg2, fontSize: 18 }}>›</div>}
    </button>
  );
}