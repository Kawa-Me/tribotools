'use client';

import type { Payment } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';
import { ClipboardCopy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentHistoryTableProps {
  payments: Payment[];
}

export function PaymentHistoryTable({ payments }: PaymentHistoryTableProps) {
  const { toast } = useToast();

  const getStatusVariant = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return 'Concluído';
      case 'pending':
        return 'Pendente';
      case 'failed':
        return 'Falhou';
      default:
        return status;
    }
  }
  
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: `${label} copiado.` });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email do Usuário</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>ID Local</TableHead>
            <TableHead>ID Gateway</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TooltipProvider>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{payment.userEmail}</TableCell>
                <TableCell>
                  {payment.createdAt ? format(payment.createdAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span>{payment.id.substring(0, 10)}...</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(payment.id, 'ID Local')}>
                          <ClipboardCopy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>{payment.id}</p></TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {payment.pushinpayTransactionId ? (
                    <div className="flex items-center gap-2">
                      <span>{payment.pushinpayTransactionId.substring(0, 10)}...</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(payment.pushinpayTransactionId!, 'ID Gateway')}>
                            <ClipboardCopy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{payment.pushinpayTransactionId}</p></TooltipContent>
                      </Tooltip>
                    </div>
                  ) : 'N/A'}
                </TableCell>
                <TableCell>
                  R$ {payment.totalPrice.toFixed(2).replace('.', ',')}
                </TableCell>
                <TableCell>
                   <Tooltip>
                    <TooltipTrigger>
                      <Badge variant={getStatusVariant(payment.status)}>
                        {getStatusText(payment.status)}
                      </Badge>
                    </TooltipTrigger>
                    {payment.status === 'failed' && payment.failureReason && (
                        <TooltipContent>
                            <p className="max-w-xs">{payment.failureReason}</p>
                        </TooltipContent>
                    )}
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum pagamento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TooltipProvider>
        </TableBody>
      </Table>
    </div>
  );
}
