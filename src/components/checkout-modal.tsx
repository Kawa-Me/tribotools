'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ClipboardCopy } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

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
});

interface PixData {
  qrcode_text: string;
  qrcode_image_url: string;
}

export function CheckoutModal({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { products, allPlans, loading: productsLoading } = useProducts();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      plans: [],
      name: '',
      document: '',
      phone: '',
    },
  });

  const selectedPlanIds = form.watch('plans') || [];
  const selectedPlans = allPlans.filter(p => selectedPlanIds.includes(p.id));
  const totalPrice = selectedPlans.reduce((sum, plan) => sum + plan.price, 0);

  useEffect(() => {
    form.register('name');
    form.register('document');
    form.register('phone');
  }, [form]);

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'Código Pix copiado para a área de transferência.' });
  };

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    if (!user?.email) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
      return;
    }

    if (totalPrice > 150) {
      toast({
        variant: 'destructive',
        title: 'Limite de Valor Excedido',
        description: 'O valor total não pode ultrapassar R$ 150,00. Por favor, adquira um item e depois o outro em compras separadas.',
      });
      return;
    }

    setLoading(true);
    setPixData(null);

    try {
      const result = await createPixPayment({
        plans: data.plans,
        email: user.email,
        name: data.name,
        document: data.document,
        phone: data.phone,
      });

      if (result.error || !result.qrcode_text || !result.qrcode_image_url) {
        throw new Error(result.error || 'Não foi possível gerar o Pix. A API retornou uma resposta inesperada.');
      }
      
      setPixData(result as PixData);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
      toast({ variant: 'destructive', title: 'Erro ao gerar Pix', description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setLoading(false);
    setPixData(null);
    form.reset();
  }

  // Intercept anonymous users and prompt them to create an account
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
        <div className="flex justify-center items-center h-48">
          <Loader className="h-10 w-10 text-primary" />
        </div>
      );
    }

    if (pixData) {
        return (
             <div className="flex flex-col items-center gap-4">
                {/* Use a standard img tag for better data URI compatibility and add a white background for scannability */}
               <img src={pixData.qrcode_image_url} alt="QR Code Pix" width={250} height={250} className="rounded-md border-2 border-primary bg-white p-1" />
               
               <Button className="w-full" size="lg" onClick={() => handleCopyToClipboard(pixData.qrcode_text)}>
                    <ClipboardCopy className="mr-2 h-4 w-4" />
                    Copiar Código PIX
               </Button>

               <p className="text-xs text-center text-muted-foreground">Após o pagamento, o acesso será liberado automaticamente em alguns instantes.</p>
            </div>
        )
    }

    if (!products.length && !productsLoading) {
        return <p className="text-center text-muted-foreground">Nenhum plano de assinatura disponível no momento.</p>
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
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

                 <div className="space-y-2 pt-2">
                    <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-xs">Nome Completo</FormLabel>
                        <FormControl>
                            <Input placeholder="Seu nome" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormField
                    control={form.control}
                    name="document"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-xs">CPF ou CNPJ</FormLabel>
                        <FormControl>
                            <Input placeholder="Apenas números" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-xs">Telefone (com DDD)</FormLabel>
                        <FormControl>
                            <Input placeholder="(99) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>

                <div className="!mt-4 space-y-1 border-t pt-2">
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
      <DialogContent className="sm:max-w-[380px] bg-background/95 backdrop-blur-sm border-primary/20 font-body">
        <DialogHeader className="p-0">
          <DialogTitle className="font-headline text-xl text-primary">Plano de Assinatura</DialogTitle>
          <DialogDescription className="text-xs">
            {pixData ? 'Escaneie o QR Code ou copie o código para pagar.' : 'Preencha seus dados para gerar o PIX.'}
          </DialogDescription>
        </DialogHeader>
        
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
