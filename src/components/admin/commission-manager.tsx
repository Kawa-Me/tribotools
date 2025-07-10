
'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, writeBatch, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Payment, Affiliate } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/hooks';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RotateCcw, Search } from 'lucide-react';

interface CommissionData extends Payment {
  affiliateEmail?: string;
}

export function CommissionManager() {
  const [commissions, setCommissions] = useState<CommissionData[]>([]);
  const [affiliates, setAffiliates] = useState<Map<string, Affiliate>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [alertInfo, setAlertInfo] = useState<{ payment: Payment, action: 'cancel' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || user.role !== 'admin' || !db) {
      if (!authLoading) setLoading(false);
      return;
    }

    const unsubAffiliates = onSnapshot(collection(db, 'affiliates'), (snapshot) => {
      const affiliatesMap = new Map<string, Affiliate>();
      snapshot.forEach(doc => {
        const affiliate = { id: doc.id, ...doc.data() } as Affiliate;
        affiliatesMap.set(affiliate.ref_code, affiliate);
      });
      setAffiliates(affiliatesMap);
    });

    const q = query(collection(db, 'payments'), where('affiliateId', '!=', null));

    const unsubCommissions = onSnapshot(q, (snapshot) => {
      const commissionData: Payment[] = [];
      snapshot.forEach(doc => {
        commissionData.push({ id: doc.id, ...doc.data() } as Payment);
      });
      setCommissions(commissionData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching commissions:", error);
      setLoading(false);
    });

    return () => {
      unsubAffiliates();
      unsubCommissions();
    };
  }, [user, authLoading]);

  const filteredCommissions = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    return commissions
      .map(c => ({
        ...c,
        affiliateEmail: affiliates.get(c.affiliateId!)?.email || 'N/A',
      }))
      .filter(c => {
        return (
          c.userEmail.toLowerCase().includes(lowercasedFilter) ||
          c.pushinpayTransactionId?.toLowerCase().includes(lowercasedFilter) ||
          c.affiliateEmail?.toLowerCase().includes(lowercasedFilter) ||
          c.affiliateId?.toLowerCase().includes(lowercasedFilter)
        );
      });
  }, [searchTerm, commissions, affiliates]);

  const handleStatusChange = async () => {
    if (!alertInfo || !db) return;

    const { payment, action } = alertInfo;
    
    if (action !== 'cancel' || !payment.commissionStatus || payment.commissionStatus === 'cancelled' || !payment.affiliateId) {
        toast({ variant: 'destructive', title: 'Ação Inválida' });
        setAlertInfo(null);
        return;
    }

    setIsProcessing(true);

    try {
        const batch = writeBatch(db);
        const paymentRef = doc(db, 'payments', payment.id);

        // Find affiliate to reverse funds
        const affiliateRefQuery = query(collection(db, 'affiliates'), where('ref_code', '==', payment.affiliateId), limit(1));
        const affiliateSnapshot = await getDocs(affiliateRefQuery);
        
        if (affiliateSnapshot.empty) {
            throw new Error(`Afiliado com ref_code ${payment.affiliateId} não encontrado.`);
        }
        const affiliateRef = affiliateSnapshot.docs[0].ref;
        const affiliateData = affiliateSnapshot.docs[0].data() as Affiliate;

        const commissionAmount = payment.commission || 0;
        
        // Reverse funds
        // This assumes commission is always in pending_balance. A more complex system might need to check available_balance.
        if (commissionAmount > 0 && affiliateData.pending_balance >= commissionAmount) {
             batch.update(affiliateRef, {
                pending_balance: admin.firestore.FieldValue.increment(-commissionAmount),
                total_earned: admin.firestore.FieldValue.increment(-commissionAmount),
            });
        } else {
            console.warn(`Cannot reverse R$${commissionAmount} from pending balance of R$${affiliateData.pending_balance} for affiliate ${payment.affiliateId}. The balance might be insufficient.`);
        }

        // Update payment status
        batch.update(paymentRef, {
            commissionStatus: 'cancelled',
            processedAt: serverTimestamp(),
        });
        
        await batch.commit();

        // TODO: Trigger n8n webhook to notify affiliate
        // const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_COMMISSION_CANCELLED_WEBHOOK;
        // if (n8nWebhookUrl) {
        //   await fetch(n8nWebhookUrl, {
        //       method: 'POST',
        //       headers: { 'Content-Type': 'application/json' },
        //       body: JSON.stringify({
        //           affiliateEmail: affiliates.get(payment.affiliateId!)?.email,
        //           buyerEmail: payment.userEmail,
        //           commissionAmount,
        //       }),
        //   });
        // }

        toast({ title: 'Sucesso!', description: 'Comissão cancelada e saldo do afiliado revertido.' });
    } catch (error) {
        console.error('Error cancelling commission:', error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível cancelar a comissão.' });
    } finally {
        setIsProcessing(false);
        setAlertInfo(null);
    }
  };

  const getStatusBadgeVariant = (status?: 'pending' | 'released' | 'paid' | 'cancelled') => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'released': return 'default';
      case 'paid': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };
   const getStatusText = (status?: 'pending' | 'released' | 'paid' | 'cancelled') => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'released': return 'Liberada';
      case 'paid': return 'Paga';
      case 'cancelled': return 'Cancelada';
      default: return 'N/A';
    }
  };

  if (loading || authLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Buscar por email do comprador, afiliado ou ID da transação..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-lg"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comprador</TableHead>
              <TableHead>Afiliado</TableHead>
              <TableHead>Transação</TableHead>
              <TableHead>Comissão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCommissions.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-xs">{c.userEmail}</TableCell>
                <TableCell className="text-xs">
                  <div>{c.affiliateEmail}</div>
                  <div className="font-mono text-muted-foreground text-xs">{c.affiliateId}</div>
                </TableCell>
                <TableCell className="text-xs">
                  <div className="font-mono">{c.pushinpayTransactionId}</div>
                  <div className="text-muted-foreground">{format(c.createdAt.toDate(), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                </TableCell>
                <TableCell className="font-semibold">R$ {c.commission?.toFixed(2) || '0.00'}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(c.commissionStatus)}>
                    {getStatusText(c.commissionStatus)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {c.commissionStatus === 'pending' && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setAlertInfo({ payment: c, action: 'cancel' })}
                    >
                      <RotateCcw className="mr-2 h-3 w-3" />
                      Reverter
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredCommissions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhuma comissão encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!alertInfo} onOpenChange={(open) => !open && setAlertInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Cancelamento de Comissão</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja cancelar esta comissão? O valor de <strong className="text-foreground">R$ {alertInfo?.payment.commission?.toFixed(2)}</strong> será revertido do saldo do afiliado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusChange} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
              {isProcessing && <Loader2 className="mr-2 animate-spin" />}
              Sim, Cancelar Comissão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
