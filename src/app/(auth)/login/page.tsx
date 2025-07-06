'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleGuestAccess = async () => {
    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Erro de Configuração',
        description: 'O serviço de autenticação não está disponível.',
      });
      return;
    }
    try {
      await signInAnonymously(auth);
      router.push('/dashboard');
    } catch (error) {
      console.error('Anonymous sign-in failed', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível acessar como visitante. Tente novamente.',
      });
    }
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Acessar sua conta</CardTitle>
        <CardDescription>Bem-vindo de volta! Insira seus dados.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Ou</span>
          </div>
        </div>

        <Button variant="secondary" className="w-full" onClick={handleGuestAccess}>
          Acessar como visitante
        </Button>

        <div className="mt-4 text-center text-sm">
          Não tem uma conta?{' '}
          <Link href="/signup" className="underline text-primary hover:text-primary/80">
            Cadastre-se
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
