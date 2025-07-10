'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Affiliate, UserData } from '@/lib/types';
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
import { Skeleton } from '../ui/skeleton';
import { PlusCircle, Trash2, Edit, Loader2, Link2, Link2Off } from 'lucide-react';
import { Badge } from '../ui/badge';

export function AffiliateEditor() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || user.role !== 'admin' || !db) {
      if (!authLoading) setLoading(false);
      return;
    }

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: UserData[] = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as UserData));
      setUsers(usersData);
    }, (error) => {
      console.error("Error fetching users:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar usuários.',
        description: 'Verifique as regras de segurança do Firestore.'
      });
    });

    const unsubAffiliates = onSnapshot(collection(db, 'affiliates'), (snapshot) => {
      const affiliatesData: Affiliate[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Affiliate));
      setAffiliates(affiliatesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching affiliates:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar afiliados.',
        description: 'Verifique as regras de segurança do Firestore.'
      });
      setLoading(false);
    });

    return () => {
        unsubAffiliates();
        unsubUsers();
    }
  }, [user, authLoading, toast]);

  const handleOpenDialog = (affiliate: Affiliate | null = null) => {
    setEditingAffiliate(affiliate);
    setIsDialogOpen(true);
  };

  const handleDelete = async (affiliateId: string) => {
    if (!db) return;
    if (!window.confirm("Tem certeza que deseja deletar este afiliado? Esta ação não pode ser desfeita.")) return;
    try {
        await deleteDoc(doc(db, 'affiliates', affiliateId));
        toast({ title: "Sucesso", description: "Afiliado deletado." });
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Erro", description: `Não foi possível deletar o afiliado. (${e.code})` });
    }
  };

  const handleSave = async (formData: Omit<Affiliate, 'id' | 'created_at' | 'updated_at' | 'total_earned' | 'pending_balance' | 'paid_balance' | 'available_balance'>) => {
    if (!db) return;
    setIsSaving(true);
    
    try {
        const docId = formData.ref_code;
        const docRef = doc(db, 'affiliates', docId);
        const docSnap = await getDoc(docRef);

        const isNewAffiliate = !docSnap.exists();

        // This is the CRITICAL check. If we are trying to create a NEW affiliate
        // but an affiliate with that ID already exists, and we are NOT in edit mode,
        // it means we are trying to create a duplicate.
        if (docSnap.exists() && !editingAffiliate) {
             toast({
                variant: 'destructive',
                title: 'Erro de Duplicidade',
                description: 'O código de referência (ID) do afiliado já existe. Por favor, escolha outro.',
            });
            setIsSaving(false);
            return;
        }

        const batch = writeBatch(db);
        
        let dataToSave: Partial<Affiliate>;

        if (isNewAffiliate) {
            // It's a brand new affiliate, set everything including initial balances
            dataToSave = {
                ...formData,
                total_earned: 0,
                pending_balance: 0,
                available_balance: 0,
                paid_balance: 0,
                created_at: serverTimestamp() as Timestamp,
                updated_at: serverTimestamp() as Timestamp,
            };
            batch.set(docRef, dataToSave);
        } else {
            // It's an existing affiliate. Only update the form data and timestamp.
            // Balances are preserved by using { merge: true }.
            dataToSave = { 
                ...formData, 
                updated_at: serverTimestamp() as Timestamp
            };
            batch.set(docRef, dataToSave, { merge: true });
        }

        if (formData.userId) {
            const userRef = doc(db, 'users', formData.userId);
            batch.update(userRef, { role: 'affiliate' });
        }
        
        if (editingAffiliate?.userId && editingAffiliate.userId !== formData.userId) {
            const oldUserRef = doc(db, 'users', editingAffiliate.userId);
            batch.update(oldUserRef, { role: 'user' });
        }

        await batch.commit();

        toast({ title: "Sucesso!", description: `Afiliado ${formData.name} salvo.` });
        setIsDialogOpen(false);
        setEditingAffiliate(null);
    } catch (error: any) {
        console.error("Error saving affiliate:", error);
        toast({ variant: 'destructive', title: "Erro ao Salvar", description: `Não foi possível salvar. (${error.code})` });
    } finally {
        setIsSaving(false);
    }
  };

  const getUserForAffiliate = (affiliate: Affiliate): UserData | undefined => {
      return users.find(u => u.uid === affiliate.userId);
  }

  if (loading || authLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2" />
          Adicionar Afiliado
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Email</TableHead>
              <TableHead>Cód. de Referência</TableHead>
              <TableHead>Chave Pix</TableHead>
              <TableHead>Comissão (%)</TableHead>
              <TableHead>Saldo Pendente</TableHead>
              <TableHead>Saldo Disponível</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {affiliates.map((affiliate) => {
              const linkedUser = getUserForAffiliate(affiliate);
              return (
                <TableRow key={affiliate.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                        <span>{affiliate.name}</span>
                        {linkedUser ? (
                             <Badge variant="secondary" className="w-fit mt-1 text-xs">
                                <Link2 className="mr-1.5" />{linkedUser.email}
                             </Badge>
                        ) : (
                             <Badge variant="destructive" className="w-fit mt-1 text-xs">
                                <Link2Off className="mr-1.5" />Não Vinculado
                            </Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{affiliate.ref_code}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                        <span className="font-mono">{affiliate.pix_key}</span>
                        <span className="text-muted-foreground uppercase">{affiliate.pix_type}</span>
                    </div>
                  </TableCell>
                  <TableCell>{affiliate.commission_percent}%</TableCell>
                  <TableCell>R$ {affiliate.pending_balance?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>R$ {affiliate.available_balance?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(affiliate)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(affiliate.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
             {affiliates.length === 0 && (
                <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhum afiliado encontrado.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AffiliateDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSave}
        affiliate={editingAffiliate}
        isSaving={isSaving}
        allUsers={users}
      />
    </div>
  );
}


interface AffiliateDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<Affiliate, 'id' | 'created_at' | 'updated_at' | 'total_earned' | 'pending_balance' | 'paid_balance' | 'available_balance'>) => void;
    affiliate: Affiliate | null;
    isSaving: boolean;
    allUsers: UserData[];
}

function AffiliateDialog({ isOpen, onOpenChange, onSave, affiliate, isSaving, allUsers }: AffiliateDialogProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [refCode, setRefCode] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [pixType, setPixType] = useState<Affiliate['pix_type']>('cpf');
    const [commissionPercent, setCommissionPercent] = useState(30);
    const [userId, setUserId] = useState<string | undefined>(undefined);
  
    useEffect(() => {
      if (affiliate) {
        setName(affiliate.name);
        setEmail(affiliate.email);
        setRefCode(affiliate.ref_code);
        setPixKey(affiliate.pix_key);
        setPixType(affiliate.pix_type);
        setCommissionPercent(affiliate.commission_percent);
        setUserId(affiliate.userId);
      } else {
        setName('');
        setEmail('');
        setRefCode('');
        setPixKey('');
        setPixType('cpf');
        setCommissionPercent(30);
        setUserId(undefined);
      }
    }, [affiliate, isOpen]);
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave({ name, email, ref_code: refCode, pix_key: pixKey, pix_type: pixType, commission_percent: commissionPercent, userId });
    };
  
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{affiliate ? 'Editar Afiliado' : 'Novo Afiliado'}</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para {affiliate ? 'atualizar o' : 'criar um novo'} afiliado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email de Contato</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="user-select">Vincular a Usuário (Login)</Label>
                <Select
                    value={userId || 'none'}
                    onValueChange={(value) => setUserId(value === 'none' ? undefined : value)}
                >
                    <SelectTrigger id="user-select">
                        <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Nenhum usuário vinculado</SelectItem>
                        {allUsers.filter(u => u.email).map(user => (
                            <SelectItem key={user.uid} value={user.uid}>{user.email}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_code">Código de Referência (ID do Afiliado)</Label>
              <Input id="ref_code" value={refCode} onChange={(e) => setRefCode(e.target.value)} required disabled={!!affiliate} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="pix_key">Chave Pix</Label>
                    <Input id="pix_key" value={pixKey} onChange={(e) => setPixKey(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="pix_type">Tipo de Chave</Label>
                     <Select
                        value={pixType}
                        onValueChange={(value: Affiliate['pix_type']) => setPixType(value)}
                    >
                        <SelectTrigger id="pix_type">
                            <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cpf">CPF</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="telefone">Telefone</SelectItem>
                            <SelectItem value="chave_aleatoria">Chave Aleatória</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commission">Comissão (%)</Label>
              <Input id="commission" type="number" value={commissionPercent} onChange={(e) => setCommissionPercent(Number(e.target.value))} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 animate-spin" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
