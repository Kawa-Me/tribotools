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
import { Menu } from 'lucide-react';
import { Rotbar } from '@/components/rotbar';
import { CheckoutModal } from '@/components/checkout-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  
    const isUnlocked = user && !user.isAnonymous && (user.role === 'admin' || user.subscription?.status === 'active');
  
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
          <Card className="bg-card/80 backdrop-blur-sm border-white/10">
              <CardHeader className="p-4">
                  <CardTitle className="text-base">{user?.isAnonymous ? 'Visitante' : 'Sua Assinatura'}</CardTitle>
                  <CardDescription className="text-xs">
                      {user?.isAnonymous ? 'Crie uma conta para acessar.' : (user?.role === 'admin' ? 'Plano: Administrador' : (isUnlocked ? `Plano: ${user?.subscription?.plan}` : 'Nenhuma assinatura ativa.'))}
                  </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                  <div className="text-xs text-muted-foreground">
                      {user?.isAnonymous ? (
                          <Button asChild size="sm" className="w-full"><Link href="/signup">Criar Conta</Link></Button>
                      ) : user?.role === 'admin' ? (
                          'Acesso vitalício'
                      ) : isUnlocked && user?.subscription?.expiresAt ? (
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
    );
  }
  
  function Header() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { modules, dbConfigured } = useModules();

    const isUnlocked = user && !user.isAnonymous && (user.role === 'admin' || user.subscription?.status === 'active');
  
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
              <Card className="bg-card/80 backdrop-blur-sm border-white/10">
                <CardHeader>
                    <CardTitle>{user?.isAnonymous ? 'Visitante' : 'Sua Assinatura'}</CardTitle>
                    <CardDescription>
                         {user?.isAnonymous ? 'Crie uma conta para acessar.' : (user?.role === 'admin' ? 'Plano: Administrador' : (isUnlocked ? `Plano: ${user?.subscription?.plan}` : 'Nenhuma assinatura ativa.'))}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                <div className="text-sm text-muted-foreground">
                        {user?.isAnonymous ? (
                            <Button asChild size="sm" className="w-full"><Link href="/signup">Criar Conta</Link></Button>
                        ) : user?.role === 'admin' ? (
                            'Acesso vitalício'
                        ) : isUnlocked && user?.subscription?.expiresAt ? (
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
        {user ? <UserNav /> : <Button asChild><Link href="/login">Fazer Login</Link></Button>}
      </header>
    );
  }
