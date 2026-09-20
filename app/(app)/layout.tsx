'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PlayerProvider } from '@/components/PlayerContext';
import Player from '@/components/Player';
import Sidebar from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login');
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="playing-indicator" style={{ justifyContent: 'center', height: 40, marginBottom: 16 }}>
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PlayerProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <div className="page-content">{children}</div>
        </main>
        <Player />
      </div>
    </PlayerProvider>
  );
}
