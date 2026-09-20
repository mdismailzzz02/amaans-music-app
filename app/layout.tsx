import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Amaan's Music",
  description: 'Your personal music library — upload, stream, and enjoy your music anywhere.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
