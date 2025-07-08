import type { Metadata } from 'next';
import { Share_Tech_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/auth-provider';
import { Toaster } from '@/components/ui/toaster';

const shareTechMono = Share_Tech_Mono({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-share-tech-mono',
});

export const metadata: Metadata = {
  title: 'Tribo Tools',
  description: 'Sua área de membros exclusiva para ferramentas hacker.',
  icons: {
    icon: {
      url: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//tribo-logo.png',
      type: 'image/png',
    },
    shortcut: {
      url: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//tribo-logo.png',
      type: 'image/png',
    },
    apple: {
      url: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//tribo-logo.png',
      type: 'image/png',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${shareTechMono.variable} dark`}>
      <body className="font-body antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
