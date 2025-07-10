'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Affiliate } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Banknote, Hourglass, CheckCircle, Handshake, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function AffiliateDashboardPage() {
  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!user || user.role !== 'affiliate' || !db) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'affiliates'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const affiliateData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Affiliate;
        setAffiliate(affiliateData);
      } else {
        setAffiliate(null); // No affiliate profile found for this user
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching affiliate data: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);
  
  const handleCopyLink = () => {
    if (!affiliate) return;
    const affiliateLink = `https://tribotools.site?ref=${affiliate.ref_code}`;
    navigator.clipboard.writeText(affiliateLink);
    toast({
      title: 'Link Copiado!',
      description: 'Seu link de afiliado foi copiado para a área de transferência.',
    });
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-1/2" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Perfil de Afiliado não Encontrado</CardTitle>
          <CardDescription>
            Não encontramos um perfil de afiliado vinculado à sua conta. Se você acredita que isso é um erro, entre em contato com o suporte.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Painel de Afiliado</h1>
        <p className="text-muted-foreground">Acompanhe seus ganhos e seu desempenho.</p>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle className="text-lg font-headline flex items-center gap-2 text-primary">
                <Handshake />
                Seu Link de Afiliado
            </CardTitle>
             <CardDescription>
                Compartilhe este link para registrar vendas e ganhar comissões.
            </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-grow w-full p-2 border rounded-md bg-muted text-center sm:text-left font-mono text-sm">
                {`https://tribotools.site?ref=${affiliate.ref_code}`}
            </div>
            <Button onClick={handleCopyLink} className="w-full sm:w-auto">
                <Copy className="mr-2" />
                Copiar Link
            </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganhos Totais</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {affiliate.total_earned.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Todo valor já gerado em comissões.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Pendente</CardTitle>
            <Hourglass className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {affiliate.pending_balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Aguardando liberação de segurança (D+2).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {affiliate.available_balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Pronto para saque.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {affiliate.paid_balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Tudo que já foi pago a você.</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold font-headline">Histórico de Comissões</h2>
        <Card>
            <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                    O histórico detalhado de transações será implementado em breve.
                </p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
