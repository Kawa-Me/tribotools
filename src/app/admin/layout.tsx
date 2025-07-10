'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { Loader } from '@/components/loader';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { Rotbar } from '@/components/rotbar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Se o usuário não existe, não é admin, ou não tem o email verificado, redireciona para fora.
    if (!user || user.role !== 'admin' || !user.emailVerified) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Enquanto carrega ou se o usuário não for um admin verificado, mostra um loader.
  if (loading || !user || user.role !== 'admin' || !user.emailVerified) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader className="h-10 w-10 text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <AdminSidebar />
        <div className="flex flex-col overflow-y-auto">
          <AdminHeader />
          <main className="flex-1 bg-background p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Rotbar />
    </>
  );
}
