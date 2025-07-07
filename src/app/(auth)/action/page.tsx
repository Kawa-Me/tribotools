'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader } from '@/components/loader';
import Link from 'next/link';

const passwordFormSchema = z.object({
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

function AuthActionHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const mode = searchParams.get('mode');
  const actionCode = searchParams.get('oobCode');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'resetPassword'>('loading');
  const [message, setMessage] = useState('Processando sua solicitação...');
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: '' },
  });

  useEffect(() => {
    if (!auth) {
        setMessage('Serviço de autenticação indisponível. Verifique a configuração do Firebase.');
        setStatus('error');
        return;
    }

    if (!mode || !actionCode) {
      setMessage('Parâmetros inválidos na URL. O link pode estar quebrado ou incompleto.');
      setStatus('error');
      return;
    }

    switch (mode) {
      case 'verifyEmail':
        handleVerifyEmail(actionCode);
        break;
      case 'resetPassword':
        handleResetPassword(actionCode);
        break;
      default:
        setMessage(`Ação desconhecida: ${mode}. O link pode ser inválido.`);
        setStatus('error');
        break;
    }
  }, [mode, actionCode]);

  const handleVerifyEmail = async (code: string) => {
    try {
      await applyActionCode(auth, code);
      setMessage('Seu email foi verificado com sucesso! Você já pode fazer login.');
      setStatus('success');
    } catch (error) {
      console.error('Email verification error:', error);
      setMessage('O link de verificação é inválido ou já expirou. Por favor, tente se cadastrar novamente.');
      setStatus('error');
    }
  };

  const handleResetPassword = async (code: string) => {
    try {
      await verifyPasswordResetCode(auth, code);
      setMessage('Código validado. Por favor, insira sua nova senha.');
      setStatus('resetPassword');
    } catch (error) {
      console.error('Password reset code verification error:', error);
      setMessage('O link para redefinir a senha é inválido ou já expirou. Por favor, solicite um novo link.');
      setStatus('error');
    }
  };

  const onPasswordResetSubmit = async (values: z.infer<typeof passwordFormSchema>) => {
    if (!actionCode) return;
    setLoading(true);
    try {
      await confirmPasswordReset(auth, actionCode, values.password);
      toast({
        title: 'Senha Redefinida!',
        description: 'Sua senha foi alterada com sucesso. Você já pode fazer login.',
      });
      router.push('/login');
    } catch (error) {
      console.error('Password reset confirmation error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível redefinir a senha. O link pode ter expirado.',
      });
      setStatus('error');
      setMessage('Ocorreu um erro ao redefinir a senha. O link pode ter expirado.');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (status) {
        case 'loading':
            return (
                <div className="flex flex-col items-center justify-center gap-4">
                    <Loader className="h-8 w-8 text-primary" />
                    <p>{message}</p>
                </div>
            );
        case 'error':
            return (
                <div className="text-center">
                    <p className="text-destructive">{message}</p>
                    <Button asChild variant="link" className="mt-4">
                    <Link href="/login">Voltar para o Login</Link>
                    </Button>
                </div>
            );
        case 'success':
            return (
                <div className="text-center">
                    <p>{message}</p>
                    <Button asChild className="mt-4">
                    <Link href="/login">Ir para o Login</Link>
                    </Button>
                </div>
            );
        case 'resetPassword':
            return (
                <>
                    <CardDescription>{message}</CardDescription>
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onPasswordResetSubmit)} className="space-y-6 pt-4">
                        <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Nova Senha</FormLabel>
                            <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader className="mr-2 h-4 w-4" />}
                        Redefinir Senha
                        </Button>
                    </form>
                    </Form>
                </>
            );
        default:
            return null;
    }
  }

  return renderContent();
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={
        <div className="flex justify-center items-center h-40">
            <Loader className="h-8 w-8 text-primary" />
        </div>
    }>
      <Card className="bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Processando Ação</CardTitle>
        </CardHeader>
        <CardContent>
          <AuthActionHandler />
        </CardContent>
      </Card>
    </Suspense>
  );
}
