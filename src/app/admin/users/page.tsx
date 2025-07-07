'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserData } from '@/lib/types';
import { UserTable } from '@/components/admin/user-table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || user.role !== 'admin') {
      if (!authLoading) setLoading(false);
      return;
    }

    if (!db) {
      setError('Serviço de banco de dados não configurado.');
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const usersData: UserData[] = [];
        querySnapshot.forEach((doc) => {
          usersData.push({ uid: doc.id, ...doc.data() } as UserData);
        });
        setUsers(usersData);
        setError(null); // Limpa o erro se a busca for bem sucedida
        setLoading(false);
      },
      (firestoreError) => {
        console.error("Firestore snapshot error in AdminUsersPage:", firestoreError);
        if (firestoreError.code === 'permission-denied') {
          setError('Acesso negado. Suas regras de segurança do Firestore não permitem que administradores listem os usuários. Por favor, atualize as regras de segurança no console do Firebase.');
        } else {
          setError('Ocorreu um erro inesperado ao buscar os usuários.');
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciar Usuários</h1>
        <p className="text-muted-foreground">
          Visualize, edite o status e a data de expiração das assinaturas dos usuários.
        </p>
      </div>
      
      {loading && (
        <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>
      )}

      {error && (
        <Card className="bg-destructive/10 border-destructive/50">
            <CardHeader>
                <CardTitle className="text-destructive">Erro ao Carregar Usuários</CardTitle>
                <CardContent className="pt-4">
                    <p className="text-destructive-foreground/80">{error}</p>
                </CardContent>
            </CardHeader>
        </Card>
      )}

      {!loading && !error && <UserTable users={users} />}
    </div>
  );
}
