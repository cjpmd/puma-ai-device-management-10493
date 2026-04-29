import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export function OrgTypeProvider({ children }: { children: React.ReactNode }) {
  const [orgType, setOrgType] = useState<OrgType>('team');
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabaseAny = supabase as any;

    const derive = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Check local user_academies mirror (synced from Football Central)
      const { data: uaRows } = await supabaseAny
        .from('user_academies')
        .select('academy_id')
        .eq('user_id', user.id)
        .limit(1);

      if (uaRows?.length) {
        setOrgType('academy');
        setAcademyId(uaRows[0].academy_id);
        setLoading(false);
        return;
      }

      // 2. Check if this user is head_of_academy on any synced academy
      const { data: headRows } = await supabaseAny
        .from('academies')
        .select('id')
        .eq('head_of_academy_user_id', user.id)
        .limit(1);

      if (headRows?.length) {
        setOrgType('academy');
        setAcademyId(headRows[0].id);
        setLoading(false);
        return;
      }

      // 3. Check user_club_access
      const { data: clubRows } = await supabaseAny
        .from('user_club_access')
        .select('club_id')
        .eq('user_id', user.id)
        .limit(1);

      if (clubRows?.length) {
        setOrgType('club');
        setLoading(false);
        return;
      }

      // 4. Default: team-level user
      setOrgType('team');
      setLoading(false);
    };

    derive();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      derive();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <OrgTypeContext.Provider value={{ orgType, academyId, loading }}>
      {children}
    </OrgTypeContext.Provider>
  );
}

export const useOrgType = () => useContext(OrgTypeContext);
