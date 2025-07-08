'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, Timestamp, getDocs } from 'firebase/firestore';
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

export function CouponEditor() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const { products, loading: productsLoading } = useProducts();
  const [isSaving, setIsSaving] = useState(false);
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
      const couponsData: Coupon[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
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
  
  const handleCouponChange = (couponId: string, field: keyof Coupon, value: any) => {
    setCoupons(prev => prev.map(c => (c.id === couponId ? { ...c, [field]: value } : c)));
  };

  const handleDateChange = (couponId: string, field: 'startDate' | 'endDate', dateString: string) => {
    if (!dateString) return;
    const timestamp = Timestamp.fromDate(new Date(dateString));
    handleCouponChange(couponId, field, timestamp);
  };
  
  const handleProductSelectionChange = (couponId: string, productId: string, isChecked: boolean) => {
    setCoupons(prev => prev.map(c => {
      if (c.id === couponId) {
        const currentProducts = c.applicableProductIds || [];
        const newProducts = isChecked
          ? [...currentProducts, productId]
          : currentProducts.filter(id => id !== productId);
        return { ...c, applicableProductIds: newProducts };
      }
      return c;
    }));
  };
  
  const handleAddNewCoupon = async () => {
    if (!db) return;
    if (isSaving) return;

    setIsSaving(true);
    const newId = `NOVO_CUPOM_${Date.now()}`;
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + 30);
    
    const newCoupon: Coupon = {
      id: newId,
      discountPercentage: 10,
      startDate: Timestamp.fromDate(now),
      endDate: Timestamp.fromDate(endDate),
      applicableProductIds: [],
      isActive: false,
    };

    try {
      await setDoc(doc(db, 'coupons', newId), newCoupon);
      toast({ title: "Cupom temporário criado", description: "Edite o código e salve as alterações." });
    } catch (error: any) {
      console.error("Error adding new coupon:", error);
      toast({
        variant: 'destructive',
        title: "Erro ao Adicionar Cupom",
        description: `Falha ao criar o cupom. Verifique as regras de segurança do Firestore. (${error.code})`,
        duration: 9000,
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteCoupon = async (couponId: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este cupom?")) return;
    if (!db) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'coupons', couponId));
      toast({ title: "Sucesso", description: "Cupom deletado." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Erro", description: `Não foi possível deletar o cupom. (${e.code})` });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSaveCoupon = async (coupon: Coupon) => {
    if (!db) return;

    if (coupon.id.includes('NOVO_CUPOM')) {
      toast({ variant: 'destructive', title: "Erro", description: "Por favor, defina um código para o novo cupom antes de salvar." });
      return;
    }

    setIsSaving(true);
    try {
        const uppercaseId = coupon.id.toUpperCase();
        // Check if a coupon with the new ID already exists (if ID was changed)
        const allCouponsDocs = await getDocs(collection(db, 'coupons'));
        const existingCoupon = allCouponsDocs.docs.find(doc => doc.id.toUpperCase() === uppercaseId && doc.id !== coupon.id);
        if (existingCoupon) {
            toast({ variant: 'destructive', title: "Erro de Duplicidade", description: `O código de cupom "${uppercaseId}" já existe.` });
            setIsSaving(false);
            return;
        }

      const couponRef = doc(db, 'coupons', uppercaseId);
      await setDoc(couponRef, { ...coupon, id: uppercaseId });
      toast({ title: "Sucesso!", description: `Cupom ${uppercaseId} salvo.` });
    } catch (error: any) {
      console.error("Error saving coupon:", error);
      toast({ variant: 'destructive', title: "Erro ao Salvar", description: `Não foi possível salvar as alterações. (${error.code})` });
    } finally {
        setIsSaving(false);
    }
  };

  if (loading || authLoading || productsLoading) {
    return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button onClick={handleAddNewCoupon} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <PlusCircle className="mr-2" />}
            Adicionar Cupom
        </Button>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {coupons.map((coupon) => (
          <AccordionItem value={coupon.id} key={coupon.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex justify-between items-center w-full pr-4">
                <div className="flex items-center gap-4">
                  <Switch
                    checked={coupon.isActive}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={(checked) => handleCouponChange(coupon.id, 'isActive', checked)}
                  />
                  <span className={cn("font-bold", !coupon.isActive && "text-muted-foreground")}>{coupon.id} ({coupon.discountPercentage}%)</span>
                </div>
                <div className='flex items-center gap-2'>
                    <Button
                        size="sm"
                        disabled={isSaving}
                        onClick={(e) => {e.stopPropagation(); handleSaveCoupon(coupon);}}
                    >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save />} Salvar
                    </Button>
                    <Button
                        variant="destructive"
                        size="icon"
                        disabled={isSaving}
                        onClick={(e) => { e.stopPropagation(); handleDeleteCoupon(coupon.id); }}
                    ><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 p-4 border rounded-md bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`id-${coupon.id}`}>Código do Cupom</Label>
                    <Input id={`id-${coupon.id}`} value={coupon.id} onChange={(e) => handleCouponChange(coupon.id, 'id', e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`discount-${coupon.id}`}>Desconto (%)</Label>
                    <Input id={`discount-${coupon.id}`} type="number" value={coupon.discountPercentage} onChange={(e) => handleCouponChange(coupon.id, 'discountPercentage', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`start-date-${coupon.id}`}>Data de Início</Label>
                    <Input id={`start-date-${coupon.id}`} type="datetime-local" value={format(coupon.startDate.toDate(), "yyyy-MM-dd'T'HH:mm")} onChange={(e) => handleDateChange(coupon.id, 'startDate', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`end-date-${coupon.id}`}>Data de Fim</Label>
                    <Input id={`end-date-${coupon.id}`} type="datetime-local" value={format(coupon.endDate.toDate(), "yyyy-MM-dd'T'HH:mm")} onChange={(e) => handleDateChange(coupon.id, 'endDate', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t">
                    <Label>Aplicável aos Produtos</Label>
                    <p className='text-xs text-muted-foreground'>Se nenhum for selecionado, o cupom será válido para todos os produtos.</p>
                    <div className="grid grid-cols-2 gap-2">
                        {products.map(product => (
                            <div key={product.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`product-${coupon.id}-${product.id}`}
                                    checked={(coupon.applicableProductIds || []).includes(product.id)}
                                    onCheckedChange={(checked) => handleProductSelectionChange(coupon.id, product.id, !!checked)}
                                />
                                <label htmlFor={`product-${coupon.id}-${product.id}`} className="text-sm font-medium leading-none">
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
