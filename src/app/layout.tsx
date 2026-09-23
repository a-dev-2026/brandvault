import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrandVault',
  description: 'work in progress',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
