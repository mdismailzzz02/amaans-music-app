'use client';

import { PlayerProvider } from '@/components/PlayerContext';
import Player from '@/components/Player';
import Sidebar from '@/components/Sidebar';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
