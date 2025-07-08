'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { Loader } from '@/components/loader';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { Rotbar } from '@/components/rotbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { sendEmailVerification, signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (!auth) return;
      signInAnonymously(auth).catch((error) => {
        console.error("DashboardLayout: Anonymous sign-in failed, redirecting to login.", error);
        router.replace('/login');
      });
      return;
    }
    
    if (user.role === 'admin' && !user.isAnonymous && user.emailVerified && !pathname.startsWith('/admin')) {
      router.replace('/admin');
    }
  }, [user, loading, router, pathname]);

  if (!loading && user && !user.isAnonymous && !user.emailVerified) {
    return <VerifyEmailScreen />;
  }

  if (loading || !user) {
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
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            clearInterval(interval);
            toast({
              title: "Email Verificado!",
              description: "Sua conta foi ativada com sucesso. Bem-vindo!",
            });
          }
        }
      }, 3000);

      return () => clearInterval(interval);
    }, [toast]);

    const handleSignOut = async () => {
        try {
            if (auth) {
                await auth.signOut();
                router.push('/login');
            }
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
