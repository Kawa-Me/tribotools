'use client';

import { usePayments } from '@/hooks/use-payments';
import { WebhookHistoryTable } from '@/components/admin/webhook-history-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminWebhooksPage() {
  const { payments, loading, error } = usePayments();

  // We are only interested in payments that have been processed by a webhook
  const completedWebhooks = payments.filter(p => p.status === 'completed');
  const failedWebhooks = payments.filter(p => p.status === 'failed');

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

      {!loading && !error && (
        <Tabs defaultValue="completed" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
                <TabsTrigger value="completed">Concluídos ({completedWebhooks.length})</TabsTrigger>
                <TabsTrigger value="failed">Falhas ({failedWebhooks.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="completed" className="mt-4">
                <WebhookHistoryTable payments={completedWebhooks} />
            </TabsContent>
            <TabsContent value="failed" className="mt-4">
                <WebhookHistoryTable payments={failedWebhooks} />
            </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
