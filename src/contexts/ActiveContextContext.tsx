import React, { createContext, useContext } from 'react';
import {
  useActiveContextData,
  type ActiveContext,
  type ContextKind,
  type UserGroupTier,
  type UseActiveContextReturn,
} from '@/hooks/useActiveContext';

const ActiveContextContext = createContext<UseActiveContextReturn>({
  activeContext: null,
  availableContexts: [],
  setActiveContext: () => {},
  loading: true,
});

export function ActiveContextProvider({ children }: { children: React.ReactNode }) {
  const value = useActiveContextData();
  return (
    <ActiveContextContext.Provider value={value}>
      {children}
    </ActiveContextContext.Provider>
  );
}

/** Primary hook — call this from any component or page. */
export function useActiveContext(): UseActiveContextReturn {
  return useContext(ActiveContextContext);
}

export type { ActiveContext, ContextKind, UserGroupTier };
