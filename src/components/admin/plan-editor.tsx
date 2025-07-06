'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, Plan } from '@/lib/types';
import { initialProducts } from '@/lib/plans';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Save, ArrowUp, ArrowDown } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function PlanEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'products'), async (snapshot) => {
      if (snapshot.empty && db) {
        console.log("No products found. Seeding initial data...");
        setLoading(true);
        try {
          const batch = writeBatch(db);
          initialProducts.forEach((productData) => {
            const productRef = doc(db, 'products', productData.id);
            batch.set(productRef, productData);
          });
          await batch.commit();
          toast({ title: 'Sucesso!', description: 'Planos iniciais criados.' });
        } catch (error) {
          console.error("Error seeding plans:", error);
          toast({ variant: 'destructive', title: 'Erro ao criar planos iniciais.' });
        } finally {
            setLoading(false);
        }
      } else {
        const productsData: Product[] = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as any))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setProducts(productsData);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [toast]);

  const handleProductChange = (productId: string, field: keyof Product, value: any) => {
    setProducts((prev) =>
      prev.map((prod) => (prod.id === productId ? { ...prod, [field]: value } : prod))
    );
  };

  const handlePlanChange = (productId: string, planId: string, field: keyof Plan, value: any) => {
    setProducts((prev) =>
      prev.map((prod) =>
        prod.id === productId
          ? {
              ...prod,
              plans: prod.plans.map((plan) =>
                plan.id === planId ? { ...plan, [field]: value } : plan
              ),
            }
          : prod
      )
    );
  };
  
  const handleAddNewProduct = () => {
    const newId = `product_${Date.now()}`;
    const newProduct: Product = {
      id: newId,
      name: 'Novo Produto',
      order: products.length,
      plans: [],
    };
    setProducts([...products, newProduct]);
  };

  const handleDeleteProduct = (productId: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este produto e todos os seus planos? Esta ação não pode ser desfeita.")) return;
    setProducts((prev) => prev.filter(p => p.id !== productId));
  };
  
  const handleAddNewPlan = (productId: string) => {
    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id === productId) {
          const newPlan: Plan = {
            id: `${prod.id}_plan_${Date.now()}`,
            name: 'Novo Plano',
            price: 0,
            originalPrice: 0,
            description: 'Descrição do novo plano.',
            days: 30,
            promo: false,
          };
          return { ...prod, plans: [...prod.plans, newPlan] };
        }
        return prod;
      })
    );
  };
  
  const handleDeletePlan = (productId: string, planId: string) => {
     setProducts((prev) =>
      prev.map((prod) =>
        prod.id === productId
          ? { ...prod, plans: prod.plans.filter((p) => p.id !== planId) }
          : prod
      )
    );
  };

  const handleSaveAllChanges = async () => {
    if (!db) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço de banco de dados indisponível.' });
      return;
    }
    
    // First, find all current product IDs in the database to detect deletions
    const existingProducts = await collection(db, 'products').get();
    const existingIds = new Set(existingProducts.docs.map(d => d.id));
    const currentIds = new Set(products.map(p => p.id));

    try {
      const batch = writeBatch(db);

      // Handle creations and updates
      products.forEach((prod, index) => {
        const productRef = doc(db, 'products', prod.id);
        batch.set(productRef, { ...prod, order: index });
      });

      // Handle deletions
      existingIds.forEach(id => {
        if (!currentIds.has(id)) {
          batch.delete(doc(db, 'products', id));
        }
      });
      
      await batch.commit();
      toast({ title: 'Sucesso!', description: 'Todas as alterações nos planos foram salvas.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar as alterações.' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button onClick={handleAddNewProduct}><PlusCircle className="mr-2" />Adicionar Produto</Button>
        <Button onClick={handleSaveAllChanges}><Save className="mr-2" />Salvar Alterações</Button>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {products.map((prod) => (
          <AccordionItem value={prod.id} key={prod.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex justify-between items-center w-full pr-4">
                <span className="font-bold">{prod.name} (ID: {prod.id})</span>
                 <div
                      role="button"
                      aria-label={`Deletar produto ${prod.name}`}
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); handleDeleteProduct(prod.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDeleteProduct(prod.id); }}}
                      className={cn('p-2 rounded-md hover:bg-destructive/20 text-destructive hover:text-destructive/80')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 p-4 border rounded-md bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${prod.id}`}>Nome do Produto</Label>
                    <Input id={`name-${prod.id}`} value={prod.name} onChange={(e) => handleProductChange(prod.id, 'name', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`id-${prod.id}`}>ID do Produto (não editável)</Label>
                    <Input id={`id-${prod.id}`} value={prod.id} disabled />
                  </div>
                </div>
                
                <h4 className="font-semibold mt-4 border-t pt-4">Planos de Assinatura</h4>
                <div className="space-y-3">
                  {prod.plans.map((plan, planIndex) => (
                    <div key={plan.id} className="p-3 border rounded bg-background space-y-3">
                      <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Plano {planIndex + 1}</span>
                          <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDeletePlan(prod.id, plan.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input value={plan.name} onChange={(e) => handlePlanChange(prod.id, plan.id, 'name', e.target.value)} placeholder="Nome do plano (Ex: Mensal)" />
                        <Input value={plan.id} disabled placeholder="ID do Plano" />
                      </div>
                      <Textarea value={plan.description} onChange={(e) => handlePlanChange(prod.id, plan.id, 'description', e.target.value)} placeholder="Descrição do plano" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <div className="space-y-1">
                            <Label className="text-xs">Preço (R$)</Label>
                            <Input type="number" value={plan.price} onChange={(e) => handlePlanChange(prod.id, plan.id, 'price', parseFloat(e.target.value) || 0)} placeholder="Preço" />
                         </div>
                         <div className="space-y-1">
                            <Label className="text-xs">Preço Original (R$)</Label>
                            <Input type="number" value={plan.originalPrice} onChange={(e) => handlePlanChange(prod.id, plan.id, 'originalPrice', parseFloat(e.target.value) || 0)} placeholder="Preço Original" />
                         </div>
                         <div className="space-y-1">
                            <Label className="text-xs">Dias de Validade</Label>
                            <Input type="number" value={plan.days} onChange={(e) => handlePlanChange(prod.id, plan.id, 'days', parseInt(e.target.value) || 0)} placeholder="Dias" />
                         </div>
                         <div className="flex items-end pb-2">
                             <div className="flex items-center space-x-2">
                                <Switch id={`promo-${plan.id}`} checked={plan.promo} onCheckedChange={(checked) => handlePlanChange(prod.id, plan.id, 'promo', checked)} />
                                <Label htmlFor={`promo-${plan.id}`}>Promoção?</Label>
                             </div>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-start mt-4">
                    <Button variant="outline" onClick={() => handleAddNewPlan(prod.id)}>Adicionar Plano</Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
