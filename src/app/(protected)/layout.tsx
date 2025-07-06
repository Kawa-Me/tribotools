
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { useModules } from '@/hooks/use-modules';
import { useProducts } from '@/hooks/use-products';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/loader';
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Menu, AlertTriangle, Package } from 'lucide-react';
import { Rotbar } from '@/components/rotbar';
import { CheckoutModal } from '@/components/checkout-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // If auth is done and there's no user, it means anon sign-in failed. Redirect to login.
      if (!user) {
        router.replace('/login');
      } 
      // If user is a non-anonymous admin, they should be on the admin pages.
      else if (user.role === 'admin' && !user.isAnonymous && user.emailVerified) {
        router.replace('/admin');
      }
    }
  }, [user, loading, router]);

  // If user is loaded but not verified, show verification screen
  if (!loading && user && !user.isAnonymous && !user.emailVerified) {
    return <VerifyEmailScreen />;
  }

  // Show loader while auth is in progress, or if we are about to redirect.
  if (loading || !user || (user && !user.isAnonymous && user.role === 'admin' && user.emailVerified)) {
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

function VerifyEmailScreen() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [sending, setSending] = useState(false);

    useEffect(() => {
      const interval = setInterval(async () => {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            clearInterval(interval);
            router.refresh();
            toast({
              title: "Email Verificado!",
              description: "Sua conta foi ativada com sucesso. Bem-vindo!",
            });
          }
        }
      }, 3000); // Check every 3 seconds

      return () => clearInterval(interval);
    }, [router, toast]);

    const handleSignOut = async () => {
        try {
            await auth.signOut();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao sair.' });
        }
    }

    const handleResendVerification = async () => {
        if (!auth.currentUser) return;
        setSending(true);
        try {
            await sendEmailVerification(auth.currentUser);
            toast({
                title: 'Email Reenviado!',
                description: 'Verifique sua caixa de entrada para o novo link de verificação.'
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Não foi possível reenviar o email. Tente novamente mais tarde.'
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl text-primary">Verifique seu Endereço de Email</CardTitle>
                    <CardDescription>
                        Enviamos um link de ativação para <strong>{user?.email}</strong>. Por favor, clique no link para ser liberado.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Não recebeu o email? Verifique sua pasta de spam ou clique no botão abaixo para reenviar.
                    </p>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                    <Button onClick={handleResendVerification} disabled={sending} className="w-full">
                        {sending ? <Loader className="mr-2" /> : null}
                        Reenviar Email de Verificação
                    </Button>
                    <Button variant="outline" onClick={handleSignOut} className="w-full">
                        Usar outro email
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}


function SubscriptionCard() {
    const { user } = useAuth();
    const { products, loading } = useProducts();

    if (user?.isAnonymous) {
        return (
            <Card className="bg-card/80 backdrop-blur-sm border-white/10">
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Nossos Planos</CardTitle>
                    <CardDescription className="text-xs">
                        Faça um upgrade para ter acesso ilimitado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <CheckoutModal>
                        <Button size="sm" className="w-full mt-2">Ver Planos</Button>
                    </CheckoutModal>
                </CardContent>
            </Card>
        );
    }

    const userSubscriptions = user?.subscriptions ? Object.entries(user.subscriptions) : [];
    
    return (
        <Card className="bg-card/80 backdrop-blur-sm border-white/10">
            <CardHeader className="p-4">
                <CardTitle className="text-base">Minhas Assinaturas</CardTitle>
                {user?.role === 'admin' && <CardDescription className="text-xs">Plano: Administrador</CardDescription>}
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
                {user?.role === 'admin' ? (
                     <div className="text-xs text-muted-foreground">Acesso vitalício a todos os produtos.</div>
                ) : userSubscriptions.length > 0 ? (
                    userSubscriptions.map(([productId, sub]) => {
                        let daysLeft: number | null = null;
                        if (sub.status === 'active' && sub.expiresAt) {
                            const now = new Date();
                            const expires = sub.expiresAt.toDate();
                            now.setHours(0, 0, 0, 0);
                            expires.setHours(0, 0, 0, 0);
                            const diffTime = expires.getTime() - now.getTime();
                            daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }

                        const productName = products.find(p => p.id === productId)?.name || productId;

                        return (
                            <div key={productId} className="text-xs space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-foreground flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{productName}</span>
                                    <span className={`font-bold ${sub.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                                        {sub.status === 'active' ? 'Ativa' : 'Expirada'}
                                    </span>
                                </div>
                                {daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && (
                                    <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-950/50 p-2 mt-1">
                                        <div className="flex items-center gap-2 text-amber-300">
                                            <AlertTriangle className="h-4 w-4" />
                                            <p className="text-xs font-semibold">Atenção!</p>
                                        </div>
                                        <p className="text-xs text-amber-400">
                                            {daysLeft === 0 ? 'Sua assinatura expira hoje.' : `Expira em ${daysLeft} dias.`}
                                        </p>
                                    </div>
                                )}
                                {sub.status !== 'active' && <p className="text-muted-foreground">Renove para reativar o acesso.</p>}
                            </div>
                        );
                    })
                ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma assinatura ativa.</p>
                )}
                <CheckoutModal>
                    <Button size="sm" className="w-full mt-2">
                        {userSubscriptions.length > 0 ? 'Gerenciar / Adicionar Planos' : 'Ver Planos'}
                    </Button>
                </CheckoutModal>
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

    