'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

      const isAdmin = user.email === 'kawameller@gmail.com';

      // If the user is the admin, ensure their role is correctly set in Firestore.
      if (isAdmin) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        // Ensure the admin role is set, creating or updating the document as needed.
        if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
           await setDoc(userDocRef, { 
              email: user.email, 
              role: 'admin',
              // Preserve existing subscriptions if the document already exists
              subscriptions: userDoc.exists() ? userDoc.data().subscriptions : {}
          }, { merge: true });
        }
      }
      
      if (isAdmin) {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }

      toast({ title: 'Sucesso!', description: 'Login realizado com sucesso.' });
    } catch (error: any) {
      console.error("Login error:", error);
      let description = 'Ocorreu um erro. Tente novamente mais tarde.';

      if (error.code) {
        if (error.code === 'auth/invalid-credential') {
          description = 'Credenciais inválidas. Verifique seu email e senha. Se ainda não tiver uma conta, por favor, cadastre-se.';
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
