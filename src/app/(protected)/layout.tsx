'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { useModules } from '@/hooks/use-modules';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/loader';
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { Rotbar } from '@/components/rotbar';
import { CheckoutModal } from '@/components/checkout-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
    if (!loading && user?.role === 'admin') {
      router.replace('/admin');
    }
  }, [user, loading, router]);

  if (loading || !user || user.role === 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader className="h-10 w-10 text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <div className="flex flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 lg:p-8">
              {children}
          </main>
        </div>
      </div>
      <Rotbar />
    </>
  );
}

function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { modules, dbConfigured } = useModules();
  
    if (!user) return null;
  
    const isUnlocked = user.role === 'admin' || user.subscription?.status === 'active';
  
    return (
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center justify-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Logo />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            <nav className="grid items-start px-2 py-4 text-sm font-medium lg:px-4">
              {!dbConfigured && (
                <p className="p-4 text-xs text-destructive">
                    Erro: DB não configurado.
                </p>
              )}
              {modules.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/dashboard/module/${mod.id}`}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                    pathname === `/dashboard/module/${mod.id}` && 'bg-muted text-primary'
                  )}
                >
                  <mod.icon className="h-4 w-4" />
                  {mod.title}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-auto p-4">
            <Card className="bg-card/80 backdrop-blur-sm border-white/10">
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Sua Assinatura</CardTitle>
                    <CardDescription className="text-xs">
                        {user.role === 'admin' ? 'Plano: Administrador' : (isUnlocked ? `Plano: ${user.subscription.plan}` : 'Nenhuma assinatura ativa.')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="text-xs text-muted-foreground">
                        {user.role === 'admin' ? (
                            'Acesso vitalício'
                        ) : isUnlocked && user.subscription.expiresAt ? (
                            `Expira em: ${new Date(user.subscription.expiresAt.seconds * 1000).toLocaleDateString()}`
                        ) : (
                             <CheckoutModal>
                               <Button size="sm" className="w-full">Fazer Upgrade</Button>
                             </CheckoutModal>
                        )}
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  
  function Header() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { modules, dbConfigured } = useModules();

    if (!user) return null;
    const isUnlocked = user.role === 'admin' || user.subscription?.status === 'active';
  
    return (
      <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col bg-background">
          <nav className="grid gap-2 text-lg font-medium">
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 text-lg font-semibold mb-4"
              >
                <Logo />
              </Link>
               {!dbConfigured && (
                  <p className="p-4 text-sm text-destructive">
                      Erro: DB não configurado.
                  </p>
                )}
              {modules.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/dashboard/module/${mod.id}`}
                  className={cn(
                    'flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground',
                     pathname === `/dashboard/module/${mod.id}` && 'bg-muted text-foreground'
                  )}
                >
                  <mod.icon className="h-5 w-5" />
                  {mod.title}
                </Link>
              ))}
            </nav>
            <div className="mt-auto">
              <Card className="bg-card/80 backdrop-blur-sm border-white/10">
                <CardHeader>
                    <CardTitle>Sua Assinatura</CardTitle>
                    <CardDescription>
                         {user.role === 'admin' ? 'Plano: Administrador' : (isUnlocked ? `Plano: ${user.subscription.plan}` : 'Nenhuma assinatura ativa.')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                <div className="text-sm text-muted-foreground">
                        {user.role === 'admin' ? (
                            'Acesso vitalício'
                        ) : isUnlocked && user.subscription.expiresAt ? (
                            `Expira em: ${new Date(user.subscription.expiresAt.seconds * 1000).toLocaleDateString()}`
                        ) : (
                            <CheckoutModal>
                                <Button size="sm" className="w-full">Fazer Upgrade</Button>
                            </CheckoutModal>
                        )}
                    </div>
                </CardContent>
              </Card>
            </div>
          </SheetContent>
        </Sheet>
  
        <div className="w-full flex-1">
          {/* Can add search bar here if needed */}
        </div>
        <UserNav />
      </header>
    );
  }
