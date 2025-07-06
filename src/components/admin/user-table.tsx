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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';

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

  const handleSaveChanges = async (newSubscription: UserSubscription) => {
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
        subscription: newSubscription,
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
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.uid}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.subscription.plan || 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant={user.subscription.status === 'active' ? 'default' : 'destructive'}>
                    {user.subscription.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.subscription.expiresAt
                    ? format(user.subscription.expiresAt.toDate(), 'dd/MM/yyyy')
                    : 'N/A'}
                </TableCell>
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
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
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
  onSave: (subscription: UserSubscription) => void;
}

function EditUserDialog({ user, isOpen, onOpenChange, onSave }: EditUserDialogProps) {
  const [subscription, setSubscription] = useState<UserSubscription>(user.subscription);

  const handleSubmit = () => {
    onSave(subscription);
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    if (date) {
      const [year, month, day] = date.split('-').map(Number);
      const timestamp = Timestamp.fromDate(new Date(year, month - 1, day));
      setSubscription({ ...subscription, expiresAt: timestamp });
    } else {
        setSubscription({ ...subscription, expiresAt: null });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize os dados da assinatura de {user.email}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="plan" className="text-right">
              Plano
            </Label>
            <Select
                value={subscription.plan || ''}
                onValueChange={(value) => setSubscription({ ...subscription, plan: value as UserSubscription['plan'] })}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
             <Label htmlFor="status" className="text-right">
              Status
            </Label>
            <Select
                value={subscription.status}
                onValueChange={(value) => setSubscription({ ...subscription, status: value as UserSubscription['status'] })}
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
            <Label htmlFor="expiresAt" className="text-right">
              Expira em
            </Label>
            <Input
              id="expiresAt"
              type="date"
              className="col-span-3"
              value={subscription.expiresAt ? format(subscription.expiresAt.toDate(), 'yyyy-MM-dd') : ''}
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
