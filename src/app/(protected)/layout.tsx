
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { useModules } from '@/hooks/use-modules';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/loader';
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Menu, AlertTriangle } from 'lucide-react';
import { Rotbar } from '@/components/rotbar';
import { CheckoutModal } from '@/components/checkout-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { plans } from '@/lib/plans';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If we're done loading and have no user (neither real nor anonymous), redirect to login.
    if (!loading && !user) {
      router.replace('/login');
    }
    
    // If a logged-in user is an admin, they should be on the admin panel.
    if (user && !user.isAnonymous && user.role === 'admin') {
      router.replace('/admin');
    }
  }, [user, loading, router]);

  // Show a loader during auth check, if we need to redirect, or if an admin lands here.
  if (loading || !user || (user.role === 'admin' && !user.isAnonymous)) {
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

function SubscriptionCard() {
    const { user } = useAuth();
    const isUnlocked = user && !user.isAnonymous && (user.role === 'admin' || user.subscription?.status === 'active');

    let daysLeft: number | null = null;
    if (user && !user.isAnonymous && user.subscription?.status === 'active' && user.subscription.expiresAt) {
        const now = new Date();
        const expires = user.subscription.expiresAt.toDate();
        now.setHours(0, 0, 0, 0);
        expires.setHours(0, 0, 0, 0);
        const diffTime = expires.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 7) {
            daysLeft = diffDays;
        }
    }

    return (
        <Card className="bg-card/80 backdrop-blur-sm border-white/10">
            <CardHeader className="p-4">
                <CardTitle className="text-base">{user?.isAnonymous ? 'Nossos Planos' : 'Sua Assinatura'}</CardTitle>
                <CardDescription className="text-xs">
                    {user?.isAnonymous ? 'Faça um upgrade para ter acesso ilimitado.' : (user?.role === 'admin' ? 'Plano: Administrador' : (isUnlocked ? `Plano: ${user?.subscription?.plan}` : 'Nenhuma assinatura ativa.'))}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {user?.isAnonymous ? (
                    <div className="space-y-3">
                        {plans.map(plan => (
                            <div key={plan.id} className="text-xs flex justify-between items-center">
                                <span>{plan.name}</span>
                                <span className="font-semibold text-primary">R${plan.price.toFixed(2).replace('.',',')}</span>
                            </div>
                        ))}
                        <CheckoutModal>
                            <Button size="sm" className="w-full mt-2">Fazer Upgrade</Button>
                        </CheckoutModal>
                    </div>
                ) : daysLeft !== null ? (
                    <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-950/50 p-3">
                        <div className="flex items-center gap-2 text-amber-300">
                            <AlertTriangle className="h-5 w-5" />
                            <p className="text-sm font-semibold">Atenção!</p>
                        </div>
                        <p className="text-xs text-amber-400">
                            {daysLeft === 0
                                ? 'Sua assinatura expira hoje. Renove para não perder o acesso.'
                                : daysLeft === 1
                                ? 'Sua assinatura expira amanhã. Renove para não perder o acesso.'
                                : `Sua assinatura expira em ${daysLeft} dias. Renove para não perder o acesso.`
                            }
                        </p>
                        <CheckoutModal>
                            <Button size="sm" variant="destructive" className="w-full mt-2">
                                Renovar Agora
                            </Button>
                        </CheckoutModal>
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground">
                        {user?.role === 'admin' ? (
                            'Acesso vitalício'
                        ) : isUnlocked && user?.subscription?.expiresAt ? (
                            `Expira em: ${new Date(user.subscription.expiresAt.seconds * 1000).toLocaleDateString()}`
                        ) : (
                           <CheckoutModal>
                             <Button size="sm" className="w-full">Fazer Upgrade</Button>
                           </CheckoutModal>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function Sidebar() {
    const pathname = usePathname();
    const { modules, dbConfigured } = useModules();
  
    return (
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-24 items-center justify-center border-b px-4 lg:h-32">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Logo />
            </Link>
          </div>
           {/* Add padding bottom to make sure the last nav item is visible above the fixed card */}
          <div className="flex-1 overflow-y-auto pb-36">
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
        </div>

        {/* Fixed subscription card at the bottom of the viewport */}
        <div className="fixed bottom-5 z-50 p-4 md:w-[220px] lg:w-[280px]">
          <SubscriptionCard />
        </div>
      </div>
    );
  }
  
  function Header() {
    const pathname = usePathname();
    const { modules, dbConfigured } = useModules();
  
    return (
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-neutral-800 bg-background/95 px-4 shadow-md backdrop-blur-sm lg:h-[60px] lg:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col bg-background">
            <SheetHeader>
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Navegue pelo painel do usuário.</SheetDescription>
            </SheetHeader>
            <nav className="grid gap-2 text-lg font-medium">
              <Link
                href="/dashboard"
                className="flex h-24 items-center justify-center gap-2 border-b text-lg font-semibold mb-4 lg:h-32"
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
                <SubscriptionCard />
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

    
