'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  const { setGuest } = useAuth();
  const router = useRouter();

  const handleGuestAccess = () => {
    setGuest(true);
    router.push('/dashboard');
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
