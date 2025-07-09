'use client';

import { useState } from 'react';
import { usePayments } from '@/hooks/use-payments';
import { PaymentHistoryTable } from '@/components/admin/payment-history-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/loader';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';

export default function AdminPaymentsPage() {
  const { payments, loading, error } = usePayments();
  const [isCleaning, setIsCleaning] = useState<'failed' | 'pending' | null>(null);
  const { toast } = useToast();

  const paidPayments = payments.filter(p => p.status === 'completed');
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const failedPayments = payments.filter(p => p.status === 'failed');

  const handleCleanup = async (type: 'failed' | 'pending') => {
    const endpoint = type === 'failed' ? '/api/admin/cleanup-payments' : '/api/admin/cleanup-pending-payments';
    const confirmMessage = `Tem certeza que deseja excluir todos os pagamentos com status '${type === 'failed' ? 'falhou' : 'pendente'}' com mais de 7 dias? Esta ação não pode ser desfeita.`;
    
    if (!window.confirm(confirmMessage)) {
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
    
    setIsCleaning(type);

    try {
        const token = await auth.currentUser.getIdToken(true);
        const response = await fetch(endpoint, {
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
            description: `${result.deletedCount} pagamentos do tipo '${type}' foram excluídos.`,
        });

    } catch (error: any) {
        console.error(`Cleanup error for ${type} payments:`, error);
        toast({
            variant: 'destructive',
            title: `Erro na Limpeza`,
            description: error.message || 'Não foi possível completar a operação. Verifique os logs do servidor.',
        });
    } finally {
        setIsCleaning(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Histórico de Pagamentos</h1>
          <p className="text-muted-foreground mt-1">
            Visualize todos os pagamentos gerados na plataforma e limpe registros antigos.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={() => handleCleanup('pending')} disabled={!!isCleaning} variant="outline" className="w-full sm:w-auto">
                {isCleaning === 'pending' ? <Loader className="mr-2" /> : <Trash2 className="mr-2" />}
                {isCleaning === 'pending' ? 'Limpando...' : 'Limpar Pendentes'}
            </Button>
            <Button onClick={() => handleCleanup('failed')} disabled={!!isCleaning} variant="outline" className="w-full sm:w-auto">
                {isCleaning === 'failed' ? <Loader className="mr-2" /> : <Trash2 className="mr-2" />}
                {isCleaning === 'failed' ? 'Limpando...' : 'Limpar Falhados'}
            </Button>
        </div>
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
                <CardTitle className="text-destructive">Erro ao Carregar Pagamentos</CardTitle>
                <CardContent className="pt-4">
                    <p className="text-destructive-foreground/80">{error}</p>
                </CardContent>
            </CardHeader>
        </Card>
      )}

      {!loading && !error && (
        <Tabs defaultValue="paid" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
                <TabsTrigger value="paid">Pagos ({paidPayments.length})</TabsTrigger>
                <TabsTrigger value="pending">Pendentes ({pendingPayments.length})</TabsTrigger>
                <TabsTrigger value="failed">Falhados ({failedPayments.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="paid" className="mt-4">
                <PaymentHistoryTable payments={paidPayments} />
            </TabsContent>
            <TabsContent value="pending" className="mt-4">
                <PaymentHistoryTable payments={pendingPayments} />
            </TabsContent>
             <TabsContent value="failed" className="mt-4">
                <PaymentHistoryTable payments={failedPayments} />
            </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
