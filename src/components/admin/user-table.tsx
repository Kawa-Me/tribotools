'use client';

import { useState } from 'react';
import { doc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserData, UserSubscription, Product, Plan } from '@/lib/types';
import { useProducts } from '@/hooks/use-products';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';

interface UserTableProps {
  users: UserData[];
}

export function UserTable({ users }: UserTableProps) {
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { products, loading: productsLoading } = useProducts();
  const { toast } = useToast();

  const handleEditClick = (user: UserData) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const handleSaveChanges = async (newSubscriptions: { [key: string]: UserSubscription }) => {
    if (!selectedUser || !db) {
        toast({
            variant: 'destructive',
            title: 'Erro',
            description: 'Não foi possível salvar. O serviço de banco de dados não está configurado.',
        });
        return;
    }

    // Replace client-side placeholder Timestamps with server-side ones before saving
    const subscriptionsToSave = { ...newSubscriptions };
    for (const key in subscriptionsToSave) {
        if (subscriptionsToSave[key]?.startedAt === null) {
            (subscriptionsToSave[key] as any).startedAt = serverTimestamp();
        }
    }


    try {
      const userDocRef = doc(db, 'users', selectedUser.uid);
      await updateDoc(userDocRef, {
        subscriptions: subscriptionsToSave,
      });
      toast({
        title: 'Sucesso!',
        description: `Dados de ${selectedUser.email || 'usuário'} atualizados.`,
      });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar os dados do usuário.',
      });
    }
  };

  if (productsLoading) {
    return <Skeleton className="h-48 w-full" />
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Criado em</TableHead>
              {products.map(p => <TableHead key={p.id} className="text-center">{p.name}</TableHead>)}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="font-medium">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    {user.createdAt
                        ? format(user.createdAt.toDate(), 'dd/MM/yyyy', { locale: ptBR })
                        : 'N/A'
                    }
                  </TableCell>
                  {products.map(p => {
                    const sub = user.subscriptions?.[p.id];
                    const isExpired = sub?.expiresAt && sub.expiresAt.toDate() < new Date();
                    const effectiveStatus = sub?.status === 'active' && isExpired ? 'expired' : sub?.status;
                    
                    return (
                      <TableCell key={p.id} className="text-center text-xs">
                        {effectiveStatus === 'active' && sub.expiresAt && sub.startedAt ? (
                            <div className="space-y-1">
                                {sub.startedAt && (
                                    <div className="flex items-center justify-center gap-1.5">
                                        <span className="font-semibold text-muted-foreground">De:</span>
                                        <span>{format(sub.startedAt.toDate(), 'dd/MM/yy HH:mm', { locale: ptBR })}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-center gap-1.5">
                                    <span className="font-semibold text-primary/80">Até:</span>
                                    <span className="font-bold text-primary">{format(sub.expiresAt.toDate(), 'dd/MM/yy HH:mm', { locale: ptBR })}</span>
                                </div>
                            </div>
                        ) : effectiveStatus === 'expired' ? (
                            <Badge variant="destructive">Expirado</Badge>
                        ) : (
                          <Badge variant="secondary">N/A</Badge>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right">
                      {user.role !== 'admin' && (
                          <Button variant="outline" size="sm" onClick={() => handleEditClick(user)}>
                              Editar
                          </Button>
                      )}
                  </TableCell>
                </TableRow>
            ))}
             {users.length === 0 && (
                <TableRow>
                    <TableCell colSpan={products.length + 3} className="text-center text-muted-foreground">
                        Nenhum usuário encontrado.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {selectedUser && (
        <EditUserDialog
          user={selectedUser}
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSave={handleSaveChanges}
          products={products}
        />
      )}
    </>
  );
}

interface EditUserDialogProps {
  user: UserData;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (subscriptions: { [key: string]: UserSubscription }) => void;
  products: Product[];
}

function EditUserDialog({ user, isOpen, onOpenChange, onSave, products }: EditUserDialogProps) {
  // Deep copy to avoid mutating the original user object
  const [subscriptions, setSubscriptions] = useState(JSON.parse(JSON.stringify(user.subscriptions || {})));

  const handleSubscriptionChange = (
    productId: string,
    field: keyof UserSubscription,
    value: any
  ) => {
    setSubscriptions((prev: any) => {
      const currentProductSub = prev[productId] || { status: 'none', planId: null, expiresAt: null, startedAt: null };
      
      let updatedSub = { ...currentProductSub, [field]: value };
      
      if (field === 'status') {
          if (value === 'none') {
            updatedSub = { status: 'none', planId: null, expiresAt: null, startedAt: null };
          } else if (value === 'active' && !currentProductSub.startedAt) {
              // Use null as a client-side placeholder for serverTimestamp()
              // The real serverTimestamp will be set just before saving.
              updatedSub.startedAt = null; 
          }
      }

      return {
        ...prev,
        [productId]: updatedSub
      };
    });
  };

  const handleDateChange = (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    const timestamp = dateString ? Timestamp.fromDate(new Date(dateString)) : null;
    handleSubscriptionChange(productId, 'expiresAt', timestamp);
  };

  const handleSubmit = () => {
    // Convert client-side Timestamps back to a format that can be saved
    const subscriptionsToSave = JSON.parse(JSON.stringify(subscriptions));
    Object.keys(subscriptionsToSave).forEach(key => {
        const sub = subscriptionsToSave[key];
        if (sub.startedAt && sub.startedAt.seconds) {
            sub.startedAt = new Timestamp(sub.startedAt.seconds, sub.startedAt.nanoseconds);
        }
        if (sub.expiresAt && sub.expiresAt.seconds) {
            sub.expiresAt = new Timestamp(sub.expiresAt.seconds, sub.expiresAt.nanoseconds);
        }
    });
    onSave(subscriptionsToSave);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Assinaturas de Usuário</DialogTitle>
          <DialogDescription>
            Gerencie todas as assinaturas para {user.email || 'este visitante'}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-6 py-4 pr-3">
          {products.map(product => {
            const sub = subscriptions[product.id] || { status: 'none', planId: null, expiresAt: null, startedAt: null };
            const availablePlans = product.plans;

            // Convert server Timestamps to client-side friendly format
            const clientSub = { ...sub };
            if (clientSub.startedAt && typeof clientSub.startedAt.toDate === 'function') {
                clientSub.startedAt = { seconds: clientSub.startedAt.seconds, nanoseconds: clientSub.startedAt.nanoseconds };
            }
            if (clientSub.expiresAt && typeof clientSub.expiresAt.toDate === 'function') {
                clientSub.expiresAt = { seconds: clientSub.expiresAt.seconds, nanoseconds: clientSub.expiresAt.nanoseconds };
            }

            return (
              <div key={product.id} className="space-y-4 rounded-md border bg-muted/30 p-4">
                <h4 className="font-semibold text-primary">{product.name}</h4>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`status-${product.id}`} className="text-right text-xs">Status</Label>
                  <Select
                    value={clientSub.status || 'none'}
                    onValueChange={(value: UserSubscription['status']) => handleSubscriptionChange(product.id, 'status', value)}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                      <SelectItem value="none">Nenhum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`plan-${product.id}`} className="text-right text-xs">Plano</Label>
                  <Select
                    disabled={clientSub.status === 'none'}
                    value={clientSub.planId || ''}
                    onValueChange={(value) => handleSubscriptionChange(product.id, 'planId', value)}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                       {availablePlans.map(p => (
                         <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`startedAt-${product.id}`} className="text-right text-xs">Início em</Label>
                  <Input
                    id={`startedAt-${product.id}`}
                    type="text"
                    className="col-span-3 bg-muted/50"
                    disabled
                    value={clientSub.startedAt ? format(new Timestamp(clientSub.startedAt.seconds, clientSub.startedAt.nanoseconds).toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Será definido ao salvar'}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`expiresAt-${product.id}`} className="text-right text-xs">Expira em</Label>
                  <Input
                    id={`expiresAt-${product.id}`}
                    type="datetime-local"
                    className="col-span-3"
                    disabled={clientSub.status === 'none'}
                    value={clientSub.expiresAt ? format(new Timestamp(clientSub.expiresAt.seconds, clientSub.expiresAt.nanoseconds).toDate(), "yyyy-MM-dd'T'HH:mm") : ''}
                    onChange={(e) => handleDateChange(product.id, e)}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
