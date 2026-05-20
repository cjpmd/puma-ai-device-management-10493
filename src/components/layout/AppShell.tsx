import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { supabase } from '@/integrations/supabase/client';
import { useActiveContext } from '@/contexts/ActiveContextContext';
import { useQuery } from '@tanstack/react-query';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [email, setEmail] = useState('');
  const { activeContext } = useActiveContext();
  const academyId = activeContext?.kind === 'academy' ? activeContext.id : null;

  const { data: academy } = useQuery({
    queryKey: ['topbar-academy', academyId],
    enabled: !!academyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any).from('academies')
        .select('name, club_website_url').eq('id', academyId).maybeSingle();
      return data ?? null;
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          userName={email}
          orgName={academy?.name}
          fcUrl={academy?.club_website_url || undefined}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
