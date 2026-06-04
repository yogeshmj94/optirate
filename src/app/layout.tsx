import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'optirate - Competitive Loan Auction Platform',
  description: 'Find the best loan rates in seconds. optirate auctions your loan profile across 12+ partner lenders to get you the lowest APR.',
  keywords: ['loan', 'auction', 'rates', 'personal loan', 'lowest APR', 'FinBox'],
  authors: [{ name: 'optirate team' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
