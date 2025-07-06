'use client';

import { useState } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserData, UserSubscription } from '@/lib/types';
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
import { products } from '@/lib/plans';

const productIds = Object.keys(products);

interface UserTableProps {
  users: UserData[];
}

export function UserTable({ users }: UserTableProps) {
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleEditClick = (user: UserData) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const handleSaveChanges = async (productId: string, newSubscription: UserSubscription) => {
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
        [`subscriptions.${productId}`]: newSubscription,
      });
      toast({
        title: 'Sucesso!',
        description: `Dados de ${selectedUser.email} atualizados.`,
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

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              {productIds.map(id => <TableHead key={id}>{products[id as keyof typeof products].name}</TableHead>)}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  {productIds.map(id => {
                    const sub = user.subscriptions?.[id];
                    const isExpired = sub?.expiresAt && sub.expiresAt.toDate() < new Date();
                    const effectiveStatus = sub?.status === 'active' && isExpired ? 'expired' : sub?.status;
                    return (
                      <TableCell key={id}>
                        {sub ? (
                           <Badge variant={effectiveStatus === 'active' ? 'default' : 'destructive'}>
                              {effectiveStatus || 'none'}
                            </Badge>
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
                    <TableCell colSpan={productIds.length + 2} className="text-center text-muted-foreground">
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
        />
      )}
    </>
  );
}

interface EditUserDialogProps {
  user: UserData;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (productId: string, subscription: UserSubscription) => void;
}

function EditUserDialog({ user, isOpen, onOpenChange, onSave }: EditUserDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState(productIds[0]);
  const [subscription, setSubscription] = useState<UserSubscription>(
    user.subscriptions?.[selectedProductId] || { status: 'none', plan: null, expiresAt: null, startedAt: null }
  );

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setSubscription(user.subscriptions?.[productId] || { status: 'none', plan: null, expiresAt: null, startedAt: null });
  };
  
  const handleSubmit = () => {
    onSave(selectedProductId, subscription);
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    if (dateString) {
      const date = new Date(dateString);
      const timestamp = Timestamp.fromDate(date);
      setSubscription({ ...subscription, expiresAt: timestamp });
    } else {
        setSubscription({ ...subscription, expiresAt: null });
    }
  }

  const handleStatusChange = (value: UserSubscription['status']) => {
    const newSubState: UserSubscription = { ...subscription, status: value };
    if (value === 'none') {
      newSubState.plan = null;
      newSubState.expiresAt = null;
    }
    setSubscription(newSubState);
  };

  const handlePlanChange = (value: UserSubscription['plan']) => {
    setSubscription({ ...subscription, plan: value });
  };

  const availablePlans = products[selectedProductId as keyof typeof products].plans;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize as assinaturas de {user.email}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="product" className="text-right">
                Produto
                </Label>
                <Select
                    value={selectedProductId}
                    onValueChange={handleProductChange}
                >
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                    {productIds.map(id => (
                        <SelectItem key={id} value={id}>{products[id as keyof typeof products].name}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Status
            </Label>
            <Select
                value={subscription.status}
                onValueChange={handleStatusChange}
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
            <Label htmlFor="plan" className="text-right">
              Plano
            </Label>
            <Select
                disabled={subscription.status === 'none'}
                value={subscription.plan || ''}
                onValueChange={handlePlanChange}
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
            <Label htmlFor="expiresAt" className="text-right">
              Expira em
            </Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              className="col-span-3"
              disabled={subscription.status === 'none'}
              value={subscription.expiresAt ? format(subscription.expiresAt.toDate(), "yyyy-MM-dd'T'HH:mm") : ''}
              onChange={handleDateChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Salvar alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
