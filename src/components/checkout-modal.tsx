
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { QRCodeSVG } from 'qrcode.react';
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from '@/lib/firebase';
import type { Coupon } from '@/lib/types';
import { FaWhatsapp } from 'react-icons/fa';

import { useAuth } from '@/lib/hooks';
import { useToast } from '@/hooks/use-toast';
import { useProducts } from '@/hooks/use-products';
import { createPixPayment } from '@/lib/checkout';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/loader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ClipboardCopy, Loader2, PartyPopper } from 'lucide-react';

const FormSchema = z.object({
  plans: z.array(z.string()).min(1, {
    message: 'Você precisa selecionar pelo menos um plano.',
  }),
  name: z.string().min(3, {
    message: 'Por favor, insira seu nome completo.',
  }),
  document: z.string().min(11, {
    message: 'O CPF/CNPJ deve ter pelo menos 11 dígitos (apenas números).',
  }),
  phone: z.string().min(10, {
    message: 'O telefone deve ter pelo menos 10 dígitos (com DDD).',
  }),
  couponCode: z.string().optional(),
});

interface PixData {
  qrcode_text: string;
  qrcode_image_url: string;
  paymentId: string;
}

export function CheckoutModal({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { products, allPlans, loading: productsLoading } = useProducts();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'generating' | 'pending' | 'completed'>('generating');

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      plans: [],
      name: user?.name || '',
      document: user?.document || '',
      phone: user?.phone || '',
      couponCode: '',
    },
  });

  useEffect(() => {
    if (user) {
        form.setValue('name', user.name || '');
        form.setValue('document', user.document || '');
        form.setValue('phone', user.phone || '');
    }
  }, [user, form, open]);

  // Real-time payment confirmation check
  useEffect(() => {
    if (paymentStatus === 'pending' && pixData?.paymentId && user?.subscriptions) {
        const hasBeenGranted = Object.values(user.subscriptions).some(
            sub => sub.lastTransactionId === pixData.paymentId
        );

        if (hasBeenGranted) {
            setPaymentStatus('completed');
        }
    }
  }, [user?.subscriptions, pixData, paymentStatus]);

  const selectedPlanIds = form.watch('plans') || [];
  const selectedPlans = allPlans.filter(p => selectedPlanIds.includes(p.id));
  const basePrice = selectedPlans.reduce((sum, plan) => sum + plan.price, 0);

  useEffect(() => {
    if (appliedCoupon) {
      const applicablePlans = selectedPlans.filter(plan => 
        !appliedCoupon.applicableProductIds || appliedCoupon.applicableProductIds.length === 0 || appliedCoupon.applicableProductIds.includes(plan.productId)
      );
      const eligiblePrice = applicablePlans.reduce((sum, plan) => sum + plan.price, 0);
      const discount = eligiblePrice * (appliedCoupon.discountPercentage / 100);
      setDiscountAmount(discount);
    } else {
      setDiscountAmount(0);
    }
  }, [appliedCoupon, selectedPlans]);

  const totalPrice = basePrice - discountAmount;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    if (!db) {
        toast({ variant: 'destructive', title: 'Erro de Configuração', description: 'Serviço de banco de dados não disponível.' });
        return;
    }
    setCouponLoading(true);
    setCouponError(null);
    setAppliedCoupon(null);
    setDiscountAmount(0);

    const couponId = couponCode.trim().toUpperCase();
    const couponRef = doc(db, 'coupons', couponId);

    try {
        const docSnap = await getDoc(couponRef);
        if (!docSnap.exists()) {
            throw new Error("Cupom inválido ou não encontrado.");
        }

        const coupon = { id: docSnap.id, ...docSnap.data() } as Coupon;
        const now = new Date();
        const startDate = coupon.startDate.toDate();
        const endDate = coupon.endDate.toDate();

        if (!coupon.isActive) {
            throw new Error("Este cupom não está mais ativo.");
        }
        if (now < startDate) {
            throw new Error("Este cupom ainda não é válido.");
        }
        if (now > endDate) {
            throw new Error("Este cupom já expirou.");
        }

        const selectedPlanIdsInForm = form.getValues('plans') || [];
        if (coupon.applicableProductIds && coupon.applicableProductIds.length > 0) {
             if (selectedPlanIdsInForm.length === 0) {
                throw new Error("Selecione um plano antes de aplicar o cupom.");
            }
            const isCouponApplicableToAnyCartItem = allPlans
                .filter(plan => selectedPlanIdsInForm.includes(plan.id))
                .some(cartPlan => coupon.applicableProductIds.includes(cartPlan.productId));

            if (!isCouponApplicableToAnyCartItem) {
                const applicableProductNames = products
                    .filter(p => coupon.applicableProductIds.includes(p.id))
                    .map(p => `"${p.name}"`)
                    .join(' ou ');
                throw new Error(`Este cupom é válido apenas para: ${applicableProductNames}.`);
            }
        }

        setAppliedCoupon(coupon);
        form.setValue('couponCode', coupon.id);
        toast({ title: 'Sucesso!', description: 'Cupom aplicado!' });

    } catch (error: any) {
        console.error("Coupon validation error:", error);
        setCouponError(error.message || "Ocorreu um erro ao validar o cupom.");
    } finally {
        setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponError(null);
    form.setValue('couponCode', '');
  }

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'Código Pix copiado para a área de transferência.' });
  };

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    if (!user?.uid || !user.email) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.', duration: 9000 });
      return;
    }

    if (totalPrice > 150) {
      toast({
        variant: 'destructive',
        title: 'Limite de Valor Excedido',
        description: 'O valor total não pode ultrapassar R$ 150,00. Adquira os itens em compras separadas.',
        duration: 9000
      });
      return;
    }

    setLoading(true);
    setPaymentStatus('generating');
    setPixData(null);

    try {
      const result = await createPixPayment({
        uid: user.uid,
        plans: data.plans,
        email: user.email,
        name: data.name,
        document: data.document,
        phone: data.phone,
        couponCode: appliedCoupon?.id || null,
      });

      if (result.error) {
        toast({ 
            variant: 'destructive', 
            title: 'Erro ao Gerar Pagamento', 
            description: result.error,
            duration: 9000,
        });
      } else if (result.qrcode_text && result.qrcode_image_url && result.paymentId) {
        setPixData(result as PixData);
        setPaymentStatus('pending');
      } else {
        toast({ 
            variant: 'destructive', 
            title: 'Erro Inesperado', 
            description: 'Resposta inválida do servidor. Tente novamente.',
            duration: 9000,
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido no navegador.';
      toast({ variant: 'destructive', title: 'Erro Crítico', description: errorMessage, duration: 9000 });
    } finally {
        setLoading(false);
    }
  };

  const resetState = () => {
    setLoading(false);
    setPixData(null);
    setPaymentStatus('generating');
    setCouponCode('');
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponError(null);
    form.reset();
  }

  if (user?.isAnonymous) {
    return (
      <Dialog>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-sm bg-background/95 backdrop-blur-sm border-primary/20 font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl text-primary">Crie sua conta para continuar</DialogTitle>
            <DialogDescription>
              Para realizar uma assinatura, você precisa de uma conta. É rápido e fácil!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="!mt-4 flex-col sm:flex-col sm:space-x-0 gap-2">
            <Button asChild className="w-full">
              <Link href="/signup">Criar Conta Agora</Link>
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link href="/login">Já tenho uma conta</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const renderContent = () => {
     if (loading || productsLoading) {
      return (
        <div className="flex flex-col justify-center items-center h-48 gap-4">
          <Loader className="h-10 w-10 text-primary" />
          <p className="text-sm text-muted-foreground">{paymentStatus === 'generating' ? 'Gerando pagamento...' : 'Carregando planos...'}</p>
        </div>
      );
    }

    if (paymentStatus === 'completed') {
        return (
            <div className="flex flex-col items-center gap-4 text-center">
                <PartyPopper className="h-16 w-16 text-primary" />
                <h3 className="text-xl font-bold font-headline">Pagamento Aprovado!</h3>
                <p className="text-muted-foreground">
                    Seu acesso foi liberado. Você já pode aproveitar todos os benefícios.
                </p>
                <Button onClick={() => setOpen(false)} className="w-full mt-4">
                    Fechar
                </Button>
            </div>
        );
    }
    
    if (pixData) {
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="w-full rounded-lg border border-amber-500/50 bg-amber-950/50 p-4 text-center">
              <p className="text-sm font-semibold text-amber-300">
                  APÓS PAGAR, RECARREGUE A PÁGINA PARA SEU PLANO ATIVAR.
              </p>
              <p className="text-xs text-amber-400 mt-2">
                  Se não ativar em 2 minutos, nos envie o comprovante no suporte.
              </p>
              <Button asChild variant="link" className="mt-2 text-white h-auto p-0 text-xs">
                  <a href="https://wa.me/5545984325338" target="_blank" rel="noopener noreferrer">
                      <FaWhatsapp className="mr-1" />
                      Acessar Suporte
                  </a>
              </Button>
          </div>
          <div className="rounded-md border-2 border-primary bg-white p-2">
            <QRCodeSVG
              value={pixData.qrcode_text}
              size={240}
              bgColor={'#ffffff'}
              fgColor={'#000000'}
              level={'L'}
              includeMargin={false}
            />
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={() => handleCopyToClipboard(pixData.qrcode_text)}
          >
            <ClipboardCopy className="mr-2 h-4 w-4" />
            Copiar Código PIX
          </Button>
        </div>
      );
    }

    if (!products.length && !productsLoading) {
        return <p className="text-center text-muted-foreground">Nenhum plano de assinatura disponível no momento.</p>
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                control={form.control}
                name="plans"
                render={() => (
                    <FormItem className="space-y-3">
                    {products.map((product) => (
                        <div key={product.id}>
                        <FormLabel className="text-foreground font-semibold">{product.name}</FormLabel>
                        <div className="space-y-2 mt-2">
                            {product.plans.map((plan) => (
                            <FormField
                                key={plan.id}
                                control={form.control}
                                name="plans"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 rounded-md border border-input has-[:checked]:border-primary has-[:checked]:bg-muted/50 transition-all">
                                    <FormControl>
                                    <Checkbox
                                        checked={field.value?.includes(plan.id)}
                                        onCheckedChange={(checked) => {
                                        const currentValues = field.value || [];
                                        const planIdsForThisProduct = product.plans.map(p => p.id);
                                        const otherProductSelections = currentValues.filter(
                                            selectedPlanId => !planIdsForThisProduct.includes(selectedPlanId)
                                        );
                                        
                                        if (checked) {
                                            field.onChange([...otherProductSelections, plan.id]);
                                        } else {
                                            field.onChange(otherProductSelections);
                                        }
                                        }}
                                    />
                                    </FormControl>
                                    <FormLabel className="font-normal flex-grow cursor-pointer w-full !mt-0">
                                        <div className="flex justify-between items-start">
                                            <span className="font-semibold text-foreground text-sm">{plan.name}</span>
                                            {plan.promo && (
                                                <Badge variant="destructive" className="ml-2 animate-pulse text-xs shrink-0">OFERTA</Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <span className="text-base font-bold text-primary">
                                                R${plan.price.toFixed(2).replace('.', ',')}
                                            </span>
                                            {plan.originalPrice && plan.originalPrice > plan.price && (
                                                <span className="text-xs text-muted-foreground line-through">
                                                    R${plan.originalPrice.toFixed(2).replace('.', ',')}
                                                </span>
                                            )}
                                        </div>
                                    </FormLabel>
                                </FormItem>
                                )}
                            />
                            ))}
                        </div>
                        </div>
                    ))}
                    <FormMessage />
                    </FormItem>
                )}
                />
                
                <div className="space-y-2 pt-4 border-t">
                    <Label>Cupom de Desconto</Label>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Ex: TRIBO30OFF" 
                            value={couponCode} 
                            onChange={(e) => setCouponCode(e.target.value)} 
                            disabled={!!appliedCoupon}
                        />
                        {appliedCoupon ? (
                             <Button type="button" variant="destructive" onClick={handleRemoveCoupon}>Remover</Button>
                        ) : (
                            <Button type="button" onClick={handleApplyCoupon} disabled={couponLoading}>
                                {couponLoading ? <Loader2 className="animate-spin" /> : "Aplicar"}
                            </Button>
                        )}
                    </div>
                    {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                </div>

                <div className="space-y-4 pt-4 mt-4 border-t border-input">
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="text-xs">Nome Completo</FormLabel><FormControl><Input placeholder="Seu nome" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>)} />
                    <FormField control={form.control} name="document" render={({ field }) => (<FormItem><FormLabel className="text-xs">CPF ou CNPJ</FormLabel><FormControl><Input placeholder="Apenas números" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>)} />
                    <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel className="text-xs">Telefone (com DDD)</FormLabel><FormControl><Input placeholder="(99) 99999-9999" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>)} />
                </div>
                <div className="!mt-4 space-y-2 border-t pt-2">
                    {discountAmount > 0 && (
                        <>
                            <div className="text-sm flex justify-between">
                                <span>Subtotal:</span>
                                <span>R$ {basePrice.toFixed(2).replace('.', ',')}</span>
                            </div>
                            <div className="text-sm flex justify-between text-primary">
                                <span>Desconto ({appliedCoupon?.id}):</span>
                                <span>- R$ {discountAmount.toFixed(2).replace('.', ',')}</span>
                            </div>
                        </>
                    )}
                    <div className="text-base font-bold flex justify-between">
                        <span>Total:</span>
                        <span>R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
                    </div>
                    {totalPrice > 150 && (
                        <p className="text-sm text-destructive font-semibold text-center">
                        O valor total não pode exceder R$ 150,00. Adquira os itens em compras separadas.
                        </p>
                    )}
                </div>

                <Button type="submit" className="w-full" disabled={loading || totalPrice > 150 || selectedPlanIds.length === 0}>
                Gerar Pagamento Pix
                </Button>
            </form>
            </Form>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            resetState();
        }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[380px] bg-background/95 backdrop-blur-sm border-primary/20 font-body flex flex-col max-h-[90dvh]">
        <DialogHeader className="p-0 flex-shrink-0">
          <DialogTitle className="font-headline text-xl text-primary">Plano de Assinatura</DialogTitle>
          <DialogDescription className="text-xs">
            {pixData ? 'Escaneie o QR Code ou copie o código para pagar.' : 'Preencha seus dados para gerar o PIX.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow overflow-y-auto pr-2 -mr-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
