import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SydeFlow Admin Console',
  description: 'Design Automation Pipeline Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
