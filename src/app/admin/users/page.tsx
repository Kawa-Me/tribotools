'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserData } from '@/lib/types';
import { UserTable } from '@/components/admin/user-table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || user.role !== 'admin') {
      if (!authLoading) setLoading(false);
      return;
    }

    if (!db) {
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
        setLoading(false);
      },
      (error) => {
        console.error("Firestore snapshot error in AdminUsersPage:", error);
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
      {loading ? (
        <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <UserTable users={users} />
      )}
       {!db && !loading && (
          <p className="text-destructive text-center mt-4">Erro: Serviço de banco de dados não configurado.</p>
      )}
    </div>
  );
}
