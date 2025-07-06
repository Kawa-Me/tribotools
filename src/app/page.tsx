"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { Loader } from '@/components/loader';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const handleLogin = async () => {
      if (!loading) {
        if (user) {
          // User is already logged in (either normally or anonymously)
          if (user.role === 'admin') {
            router.push('/admin');
          } else {
            router.push('/dashboard');
          }
        } else {
          // No user, attempt anonymous sign-in
          if (!auth) {
            console.error("Firebase auth is not configured. Cannot sign in anonymously.");
            toast({
              variant: 'destructive',
              title: 'Erro de Configuração',
              description: 'O serviço de autenticação não está disponível.',
            });
            // As a fallback, send to login page so it doesn't loop forever
            router.push('/login');
            return;
          }
          try {
            await signInAnonymously(auth);
            // The onAuthStateChanged listener in AuthProvider will pick this up
            // and trigger a re-render. On the next run, user will exist.
            // We can optimistically redirect.
            router.push('/dashboard');
          } catch (error: any) {
            console.error("Anonymous sign-in failed on initial load", error);
             let description = 'Não foi possível iniciar a sessão de visitante. Por favor, tente recarregar a página.';
            if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
                description = "O login anônimo precisa ser habilitado no seu painel do Firebase.";
            }
            toast({
              variant: 'destructive',
              title: 'Erro de Acesso',
              description: description,
            });
            // Fallback to login page on error
            router.push('/login');
          }
        }
      }
    };

    handleLogin();
  }, [user, loading, router, toast]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader className="h-10 w-10 text-primary" />
    </div>
  );
}
