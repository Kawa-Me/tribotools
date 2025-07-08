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

interface WebhookHistoryTableProps {
  payments: Payment[];
}

export function WebhookHistoryTable({ payments }: WebhookHistoryTableProps) {
  const { toast } = useToast();

  const getStatusVariant = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return 'Concluído';
      case 'failed':
        return 'Falhou';
      default:
        return 'Pendente';
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
            <TableHead>Email</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Processado Em</TableHead>
            <TableHead>ID Gateway</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>End-to-End ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TooltipProvider>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{payment.userEmail}</TableCell>
                <TableCell>{payment.userName}</TableCell>
                <TableCell>{payment.userPhone || 'N/A'}</TableCell>
                <TableCell>
                  {payment.processedAt ? format(payment.processedAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}
                </TableCell>
                <TableCell className="font-mono text-xs">{payment.pushinpayTransactionId || 'N/A'}</TableCell>
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
                <TableCell className="font-mono text-xs">
                    {payment.pushinpayEndToEndId ? (
                        <div className="flex items-center gap-2">
                           <span>{payment.pushinpayEndToEndId.substring(0, 15)}...</span>
                           <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(payment.pushinpayEndToEndId!, 'End-to-End ID')}>
                                        <ClipboardCopy className="h-3 w-3" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{payment.pushinpayEndToEndId}</p></TooltipContent>
                           </Tooltip>
                        </div>
                    ) : 'N/A'}
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum evento de webhook encontrado.
                </TableCell>
              </TableRow>
            )}
          </TooltipProvider>
        </TableBody>
      </Table>
    </div>
  );
}
