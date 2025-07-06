import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Recuperar senha</CardTitle>
        <CardDescription>
          Insira seu email e enviaremos um link para redefinir sua senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
        <div className="mt-4 text-center text-sm">
          Lembrou a senha?{' '}
          <Link href="/login" className="underline text-primary hover:text-primary/80">
            Faça login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
