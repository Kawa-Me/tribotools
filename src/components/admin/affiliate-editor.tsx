'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Affiliate } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/hooks';
import { format } from 'date-fns';

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
import { Skeleton } from '../ui/skeleton';
import { PlusCircle, Trash2, Edit, Loader2 } from 'lucide-react';

export function AffiliateEditor() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
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

    const unsubscribe = onSnapshot(collection(db, 'affiliates'), (snapshot) => {
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
    return () => unsubscribe();
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

  const handleSave = async (formData: Omit<Affiliate, 'id' | 'created_at' | 'total_earned' | 'pending_balance' | 'paid_balance'>) => {
    if (!db) return;
    setIsSaving(true);
    
    try {
        let affiliateData: Partial<Affiliate>;
        let docRef;

        if (editingAffiliate) {
            // Updating existing affiliate
            docRef = doc(db, 'affiliates', editingAffiliate.id);
            affiliateData = { ...formData };
        } else {
            // Creating new affiliate
            docRef = doc(collection(db, 'affiliates'));
            affiliateData = {
                ...formData,
                total_earned: 0,
                pending_balance: 0,
                paid_balance: 0,
                created_at: serverTimestamp() as any, // Cast for client-side
            };
        }
        
        await setDoc(docRef, affiliateData, { merge: true });

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
              <TableHead>Nome</TableHead>
              <TableHead>Cód. de Referência</TableHead>
              <TableHead>Comissão (%)</TableHead>
              <TableHead>Saldo Pendente</TableHead>
              <TableHead>Saldo Pago</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {affiliates.map((affiliate) => (
              <TableRow key={affiliate.id}>
                <TableCell className="font-medium">{affiliate.name}</TableCell>
                <TableCell className="font-mono text-xs">{affiliate.ref_code}</TableCell>
                <TableCell>{affiliate.commission_percent}%</TableCell>
                <TableCell>R$ {affiliate.pending_balance.toFixed(2)}</TableCell>
                <TableCell>R$ {affiliate.paid_balance.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(affiliate)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(affiliate.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
             {affiliates.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
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
      />
    </div>
  );
}


interface AffiliateDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<Affiliate, 'id' | 'created_at' | 'total_earned' | 'pending_balance' | 'paid_balance'>) => void;
    affiliate: Affiliate | null;
    isSaving: boolean;
}

function AffiliateDialog({ isOpen, onOpenChange, onSave, affiliate, isSaving }: AffiliateDialogProps) {
    const [name, setName] = useState('');
    const [refCode, setRefCode] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [commissionPercent, setCommissionPercent] = useState(30);
  
    useEffect(() => {
      if (affiliate) {
        setName(affiliate.name);
        setRefCode(affiliate.ref_code);
        setPixKey(affiliate.pix_key);
        setCommissionPercent(affiliate.commission_percent);
      } else {
        setName('');
        setRefCode('');
        setPixKey('');
        setCommissionPercent(30);
      }
    }, [affiliate, isOpen]);
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave({ name, ref_code: refCode, pix_key: pixKey, commission_percent: commissionPercent });
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
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Afiliado</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_code">Código de Referência (no link)</Label>
              <Input id="ref_code" value={refCode} onChange={(e) => setRefCode(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pix_key">Chave Pix (para pagamentos)</Label>
              <Input id="pix_key" value={pixKey} onChange={(e) => setPixKey(e.target.value)} required />
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
