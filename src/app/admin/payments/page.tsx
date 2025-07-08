'use client';

import { usePayments } from '@/hooks/use-payments';
import { PaymentHistoryTable } from '@/components/admin/payment-history-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminPaymentsPage() {
  const { payments, loading, error } = usePayments();

  const paidPayments = payments.filter(p => p.status === 'completed');
  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'failed');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Histórico de Pagamentos</h1>
        <p className="text-muted-foreground">
          Visualize todos os pagamentos gerados na plataforma, seus status e detalhes.
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
                <CardTitle className="text-destructive">Erro ao Carregar Pagamentos</CardTitle>
                <CardContent className="pt-4">
                    <p className="text-destructive-foreground/80">{error}</p>
                </CardContent>
            </CardHeader>
        </Card>
      )}

      {!loading && !error && (
        <Tabs defaultValue="paid" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
                <TabsTrigger value="paid">Pagos ({paidPayments.length})</TabsTrigger>
                <TabsTrigger value="pending">Pendentes & Falhados ({pendingPayments.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="paid" className="mt-4">
                <PaymentHistoryTable payments={paidPayments} />
            </TabsContent>
            <TabsContent value="pending" className="mt-4">
                <PaymentHistoryTable payments={pendingPayments} />
            </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
