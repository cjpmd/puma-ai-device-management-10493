import React, { createContext, useContext } from 'react';
import { useActiveContext } from '@/contexts/ActiveContextContext';

export type OrgType = 'academy' | 'club' | 'team';

interface OrgTypeContextValue {
  orgType: OrgType;
  academyId: string | null;
  loading: boolean;
}

const OrgTypeContext = createContext<OrgTypeContextValue>({
  orgType: 'team',
  academyId: null,
  loading: true,
});

/**
 * Thin adapter over ActiveContextContext.
 * Existing code that calls useOrgType() continues to work unchanged.
 * OrgType is now derived from the active context rather than re-fetching
 * membership tables independently.
 */
export function OrgTypeProvider({ children }: { children: React.ReactNode }) {
  const { activeContext, loading } = useActiveContext();

  const orgType: OrgType = activeContext?.kind ?? 'team';
  const academyId = activeContext?.kind === 'academy' ? activeContext.id : null;

  return (
    <OrgTypeContext.Provider value={{ orgType, academyId, loading }}>
      {children}
    </OrgTypeContext.Provider>
  );
}

export const useOrgType = () => useContext(OrgTypeContext);
