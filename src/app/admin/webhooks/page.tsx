'use client';

import { usePayments } from '@/hooks/use-payments';
import { WebhookHistoryTable } from '@/components/admin/webhook-history-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function AdminWebhooksPage() {
  const { payments, loading, error } = usePayments();

  // We are only interested in payments that have been processed by a webhook
  const processedPayments = payments.filter(p => p.status === 'completed' || p.status === 'failed');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Histórico de Webhooks</h1>
        <p className="text-muted-foreground">
          Visualize todos os eventos de pagamento processados via webhook.
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
                <CardTitle className="text-destructive">Erro ao Carregar Histórico</CardTitle>
                <CardContent className="pt-4">
                    <p className="text-destructive-foreground/80">{error}</p>
                </CardContent>
            </CardHeader>
        </Card>
      )}

      {!loading && !error && <WebhookHistoryTable payments={processedPayments} />}
    </div>
  );
}
