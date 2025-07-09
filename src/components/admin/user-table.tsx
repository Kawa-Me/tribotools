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

    try {
      const userDocRef = doc(db, 'users', selectedUser.uid);
      await updateDoc(userDocRef, {
        subscriptions: newSubscriptions,
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
                        {effectiveStatus === 'active' && sub.expiresAt ? (
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
  const [subscriptions, setSubscriptions] = useState(user.subscriptions || {});

  const handleSubscriptionChange = (
    productId: string,
    field: keyof UserSubscription,
    value: any
  ) => {
    setSubscriptions(prev => {
      const currentProductSub = prev[productId] || { status: 'none', plan: null, expiresAt: null, startedAt: null };
      
      let updatedSub = { ...currentProductSub, [field]: value };
      
      if (field === 'status') {
          if (value === 'none') {
            updatedSub = { status: 'none', plan: null, expiresAt: null, startedAt: null };
          } else if (value === 'active' && !currentProductSub.startedAt) {
              updatedSub.startedAt = serverTimestamp() as Timestamp;
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
    onSave(subscriptions);
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
            const sub = subscriptions[product.id] || { status: 'none', plan: null, expiresAt: null, startedAt: null };
            const availablePlans = product.plans;

            return (
              <div key={product.id} className="space-y-4 rounded-md border bg-muted/30 p-4">
                <h4 className="font-semibold text-primary">{product.name}</h4>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`status-${product.id}`} className="text-right text-xs">Status</Label>
                  <Select
                    value={sub.status || 'none'}
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
                    disabled={sub.status === 'none'}
                    value={sub.plan || ''}
                    onValueChange={(value) => handleSubscriptionChange(product.id, 'plan', value)}
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
                    value={sub.startedAt ? format(sub.startedAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Não definido'}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`expiresAt-${product.id}`} className="text-right text-xs">Expira em</Label>
                  <Input
                    id={`expiresAt-${product.id}`}
                    type="datetime-local"
                    className="col-span-3"
                    disabled={sub.status === 'none'}
                    value={sub.expiresAt ? format(sub.expiresAt.toDate(), "yyyy-MM-dd'T'HH:mm") : ''}
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
