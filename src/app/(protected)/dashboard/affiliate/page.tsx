'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Affiliate } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Banknote, Hourglass, CheckCircle, Handshake, Copy, Rocket, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { FaWhatsapp } from 'react-icons/fa';

export default function AffiliateDashboardPage() {
  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!user || user.isAnonymous || !db) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'affiliates'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const affiliateData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Affiliate;
        setAffiliate(affiliateData);
      } else {
        setAffiliate(null);
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
      <Card className="text-center bg-card/60 border-primary/20 shadow-lg shadow-primary/10">
        <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                <Crown className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="font-headline text-3xl text-primary">Torne-se um Afiliado</CardTitle>
            <CardDescription className="text-lg max-w-lg mx-auto">
                Ganhe comissões incríveis divulgando nossas ferramentas. Junte-se ao nosso time de parceiros de elite!
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-muted-foreground">Para solicitar sua afiliação, entre em contato com nosso suporte exclusivo e nossa equipe irá analisar seu perfil.</p>
            <Button asChild size="lg">
                <a href="https://wa.me/5545984325338" target="_blank" rel="noopener noreferrer">
                    <FaWhatsapp className="mr-2" />
                    Solicitar Afiliação no Suporte
                </a>
            </Button>
        </CardContent>
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
