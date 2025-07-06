'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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

export function SignupForm() {
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
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      const isAdmin = values.email === 'kawameller@gmail.com';

      // Create a user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        subscriptions: isAdmin
          ? {
              ferramentas: {
                status: 'active',
                plan: 'admin',
                startedAt: null,
                expiresAt: null,
              },
            }
          : {},
        role: isAdmin ? 'admin' : 'user',
      });

      toast({ title: 'Sucesso!', description: 'Sua conta foi criada.' });
      router.push(isAdmin ? '/admin' : '/dashboard');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        form.setError('email', {
          type: 'manual',
          message: 'Este email já está cadastrado. Por favor, faça login.',
        });
      } else {
        let description = 'Ocorreu um erro. Tente novamente mais tarde.';
        if (error.code) {
          switch (error.code) {
            case 'auth/weak-password':
              description = 'Sua senha é muito fraca. Use pelo menos 6 caracteres.';
              break;
            case 'auth/invalid-email':
              description = 'O formato do email é inválido.';
              break;
            case 'firestore/permission-denied':
              description = 'Não foi possível criar seu perfil. Verifique as permissões do banco de dados.';
              break;
            default:
              description = `Erro: ${error.code}. Por favor, tente novamente.`;
          }
        }
        toast({
          variant: 'destructive',
          title: 'Erro no cadastro',
          description: description,
        });
      }
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
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
           {loading ? <Loader className="mr-2 h-4 w-4" /> : null}
          Criar conta
        </Button>
      </form>
    </Form>
  );
}
