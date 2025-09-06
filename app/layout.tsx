import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'First Anniversary',
  description: 'Generate a new timeline',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}