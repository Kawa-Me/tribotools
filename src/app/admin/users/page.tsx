
'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserData } from '@/lib/types';
import { UserTable } from '@/components/admin/user-table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/loader';
import { Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

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
        const registeredUsers = usersData.filter(u => u.email);
        setUsers(registeredUsers);
        setError(null);
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

  const handleCleanup = async () => {
    if (!window.confirm("Tem certeza que deseja excluir todos os usuários anônimos (contas sem e-mail) criados há mais de 1 hora? Esta ação não pode ser desfeita.")) {
      return;
    }
    
    if (!auth?.currentUser) {
        toast({
            variant: 'destructive',
            title: 'Erro de Autenticação',
            description: 'Não foi possível verificar o usuário. Por favor, faça login novamente.',
        });
        return;
    }
    
    setIsCleaning(true);
    try {
        const token = await auth.currentUser.getIdToken(true);
        const response = await fetch('/api/admin/cleanup-users', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `Erro do servidor: ${response.statusText}`);
        }

        toast({
            title: 'Limpeza Concluída',
            description: `${result.deletedCount} usuários anônimos foram excluídos.`,
        });

    } catch (error: any) {
        console.error("Cleanup error:", error);
        toast({
            variant: 'destructive',
            title: 'Erro na Limpeza',
            description: error.message || 'Não foi possível completar a operação. Verifique os logs do servidor.',
        });
    } finally {
        setIsCleaning(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    if (!lowercasedFilter) return users;
    return users.filter(u => u.email?.toLowerCase().includes(lowercasedFilter));
  }, [searchTerm, users]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Gerenciar Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Visualize, edite assinaturas e remova contas anônimas inativas.
          </p>
        </div>
        <Button onClick={handleCleanup} disabled={isCleaning} variant="outline" className="w-full sm:w-auto">
            {isCleaning ? <Loader className="mr-2" /> : <Trash2 className="mr-2" />}
            {isCleaning ? 'Limpando...' : 'Limpar Anônimos'}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Buscar por email do usuário..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-lg pl-10"
        />
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

      {!loading && !error && <UserTable users={filteredUsers} />}
    </div>
  );
}
