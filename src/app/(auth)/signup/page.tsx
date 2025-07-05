import Link from 'next/link';
import { SignupForm } from '@/components/auth/signup-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-white/10">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Crie sua conta</CardTitle>
        <CardDescription>É rápido e fácil. Comece agora mesmo.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
        <div className="mt-4 text-center text-sm">
          Já tem uma conta?{' '}
          <Link href="/login" className="underline text-primary hover:text-primary/80">
            Faça login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
