'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader } from '../loader';

const formSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !db) {
        toast({
            variant: 'destructive',
            title: 'Erro de Configuração',
            description: 'O serviço de autenticação não está disponível. Contate o suporte.',
        });
        return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      // Failsafe: Ensure the primary admin email always has the 'admin' role.
      const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

      if (isAdmin) {
        try {
            const userDocRef = doc(db, 'users', user.uid);
            // This will create the document if it doesn't exist, or update it if it does.
            // The merge: true option is crucial to avoid overwriting other fields like 'subscriptions'.
            await setDoc(userDocRef, { 
                email: user.email, 
                role: 'admin'
            }, { merge: true });
            console.log("Admin role successfully verified/set in Firestore.");
        } catch (firestoreError: any) {
            console.error("CRITICAL: Failed to set admin role in Firestore.", firestoreError);
            // This is a non-blocking error for the user, but critical for the admin.
            toast({
                variant: 'destructive',
                title: 'Falha Crítica de Permissão',
                description: `Não foi possível definir o status de admin. Erro: ${firestoreError.code}`,
                duration: 9000,
            });
        }
      }
      
      // The redirect logic is now handled by the DashboardLayout,
      // which will direct the admin to the correct page automatically after login.
      // We just need to push to the generic dashboard entry point.
      router.push('/dashboard');

      toast({ title: 'Sucesso!', description: 'Login realizado com sucesso.' });
    } catch (error: any) {
      console.error("Login error:", error);
      let description = 'Ocorreu um erro. Tente novamente mais tarde.';

      if (error.code) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          description = 'Credenciais inválidas. Verifique seu email e senha.';
        } else if (error.code.startsWith('firestore/')) {
          description = 'Ocorreu um erro ao acessar os dados da sua conta. Contate o suporte.';
        } else {
          description = `Erro: ${error.code}. Por favor, tente novamente.`;
        }
      }
      
      toast({
        variant: 'destructive',
        title: 'Erro de login',
        description: description,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="seu@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Senha</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-primary hover:text-primary/80"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader className="mr-2 h-4 w-4" /> : null}
          Entrar
        </Button>
      </form>
    </Form>
  );
}
