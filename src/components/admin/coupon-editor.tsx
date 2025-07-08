'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, Timestamp, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Coupon, Product } from '@/lib/types';
import { useProducts } from '@/hooks/use-products';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/hooks';
import { format } from 'date-fns';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '../ui/skeleton';
import { PlusCircle, Trash2, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Wrapper type to hold coupon data along with a stable ID for UI state
type CouponState = {
  originalId: string;
  coupon: Coupon;
};

export function CouponEditor() {
  const [coupons, setCoupons] = useState<CouponState[]>([]);
  const [loading, setLoading] = useState(true);
  const { products, loading: productsLoading } = useProducts();
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  useEffect(() => {
    if (authLoading || !user || user.role !== 'admin') {
      if (!authLoading) setLoading(false);
      return;
    }
    if (!db) {
        setLoading(false);
        return;
    }
    const unsubscribe = onSnapshot(collection(db, 'coupons'), (snapshot) => {
      const couponsData: CouponState[] = snapshot.docs.map(doc => ({
        originalId: doc.id,
        coupon: { id: doc.id, ...doc.data() } as Coupon
      }));
      setCoupons(couponsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching coupons:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao carregar cupons.',
        description: 'Verifique se as regras de segurança do Firestore permitem a leitura da coleção "coupons".'
      });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, authLoading, toast]);
  
  const handleCouponChange = (index: number, field: keyof Coupon, value: any) => {
    setCoupons(prev => prev.map((item, i) => (i === index ? { ...item, coupon: { ...item.coupon, [field]: value } } : item)));
  };

  const handleDateChange = (index: number, field: 'startDate' | 'endDate', dateString: string) => {
    if (!dateString) return;
    const timestamp = Timestamp.fromDate(new Date(dateString));
    handleCouponChange(index, field, timestamp);
  };
  
  const handleProductSelectionChange = (index: number, productId: string, isChecked: boolean) => {
    setCoupons(prev => prev.map((item, i) => {
      if (i === index) {
        const currentProducts = item.coupon.applicableProductIds || [];
        const newProducts = isChecked
          ? [...currentProducts, productId]
          : currentProducts.filter(id => id !== productId);
        return { ...item, coupon: { ...item.coupon, applicableProductIds: newProducts } };
      }
      return item;
    }));
  };
  
  const handleAddNewCoupon = () => {
    const tempId = `NOVO_CUPOM_${Date.now()}`;
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + 30);
    
    const newCouponState: CouponState = {
        originalId: tempId,
        coupon: {
            id: tempId,
            discountPercentage: 10,
            startDate: Timestamp.fromDate(now),
            endDate: Timestamp.fromDate(endDate),
            applicableProductIds: [],
            isActive: false,
        }
    };

    setCoupons(prev => [...prev, newCouponState]);
  };
  
  const handleDeleteCoupon = async (idToDelete: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este cupom?")) return;
    if (!db) return;
    setIsSaving(idToDelete);
    try {
      await deleteDoc(doc(db, 'coupons', idToDelete));
      toast({ title: "Sucesso", description: "Cupom deletado." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Erro", description: `Não foi possível deletar o cupom. (${e.code})` });
    } finally {
      setIsSaving(null);
    }
  };
  
  const handleSaveCoupon = async (coupon: Coupon, originalId: string) => {
    if (!db) return;

    if (coupon.id.startsWith('NOVO_CUPOM')) {
      toast({ variant: 'destructive', title: "Erro", description: "Por favor, defina um código para o novo cupom antes de salvar." });
      return;
    }

    setIsSaving(originalId);
    try {
        const newId = coupon.id.toUpperCase();

        if (newId !== originalId) {
            // This is a rename operation
            const newDocRef = doc(db, 'coupons', newId);
            const oldDocRef = doc(db, 'coupons', originalId);

            const newDocSnap = await getDoc(newDocRef);
            if (newDocSnap.exists()) {
                toast({ variant: 'destructive', title: "Erro de Duplicidade", description: `O código de cupom "${newId}" já existe.` });
                setIsSaving(null);
                return;
            }

            const batch = writeBatch(db);
            batch.set(newDocRef, { ...coupon, id: newId });
            batch.delete(oldDocRef);
            await batch.commit();
        } else {
            // This is a simple update
            const couponRef = doc(db, 'coupons', newId);
            await setDoc(couponRef, coupon);
        }

      toast({ title: "Sucesso!", description: `Cupom ${newId} salvo.` });
    } catch (error: any) {
      console.error("Error saving coupon:", error);
      toast({ variant: 'destructive', title: "Erro ao Salvar", description: `Não foi possível salvar as alterações. (${error.code})` });
    } finally {
        setIsSaving(null);
    }
  };

  if (loading || authLoading || productsLoading) {
    return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button onClick={handleAddNewCoupon} disabled={!!isSaving}>
            <PlusCircle className="mr-2" />
            Adicionar Cupom
        </Button>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {coupons.map(({ coupon, originalId }, index) => (
          <AccordionItem value={originalId} key={originalId}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex justify-between items-center w-full pr-4">
                <div className="flex items-center gap-4">
                  <Switch
                    checked={coupon.isActive}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={(checked) => handleCouponChange(index, 'isActive', checked)}
                  />
                  <span className={cn("font-bold", !coupon.isActive && "text-muted-foreground")}>{coupon.id} ({coupon.discountPercentage}%)</span>
                </div>
                <div className='flex items-center gap-2'>
                    <Button
                        size="sm"
                        disabled={isSaving === originalId}
                        onClick={(e) => {e.stopPropagation(); handleSaveCoupon(coupon, originalId);}}
                    >
                        {isSaving === originalId ? <Loader2 className="animate-spin" /> : <Save />} Salvar
                    </Button>
                    <Button
                        variant="destructive"
                        size="icon"
                        disabled={isSaving === originalId}
                        onClick={(e) => { e.stopPropagation(); handleDeleteCoupon(originalId); }}
                    ><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 p-4 border rounded-md bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`id-${originalId}`}>Código do Cupom</Label>
                    <Input id={`id-${originalId}`} value={coupon.id} onChange={(e) => handleCouponChange(index, 'id', e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`discount-${originalId}`}>Desconto (%)</Label>
                    <Input id={`discount-${originalId}`} type="number" value={coupon.discountPercentage} onChange={(e) => handleCouponChange(index, 'discountPercentage', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`start-date-${originalId}`}>Data de Início</Label>
                    <Input id={`start-date-${originalId}`} type="datetime-local" value={format(coupon.startDate.toDate(), "yyyy-MM-dd'T'HH:mm")} onChange={(e) => handleDateChange(index, 'startDate', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`end-date-${originalId}`}>Data de Fim</Label>
                    <Input id={`end-date-${originalId}`} type="datetime-local" value={format(coupon.endDate.toDate(), "yyyy-MM-dd'T'HH:mm")} onChange={(e) => handleDateChange(index, 'endDate', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t">
                    <Label>Aplicável aos Produtos</Label>
                    <p className='text-xs text-muted-foreground'>Se nenhum for selecionado, o cupom será válido para todos os produtos.</p>
                    <div className="grid grid-cols-2 gap-2">
                        {products.map(product => (
                            <div key={product.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`product-${originalId}-${product.id}`}
                                    checked={(coupon.applicableProductIds || []).includes(product.id)}
                                    onCheckedChange={(checked) => handleProductSelectionChange(index, product.id, !!checked)}
                                />
                                <label htmlFor={`product-${originalId}-${product.id}`} className="text-sm font-medium leading-none">
                                    {product.name}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
