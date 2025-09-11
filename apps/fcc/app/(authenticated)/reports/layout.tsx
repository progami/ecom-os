import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Financial Reports | FCC Bookkeeping',
  description: 'Comprehensive financial reporting with real-time data from Xero',
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      {children}
    </div>
  );
}