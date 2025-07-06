
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useAuth } from '@/lib/hooks';
import { useToast } from '@/hooks/use-toast';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ClipboardCopy } from 'lucide-react';
import { products, allPlans, type PlanId } from '@/lib/plans';

const planIds = allPlans.map(p => p.id) as [PlanId, ...PlanId[]];

const FormSchema = z.object({
  plan: z.enum(planIds, {
    required_error: 'Você precisa selecionar um plano.',
  }),
  phone: z.string().min(10, {
    message: 'O telefone deve ter pelo menos 10 dígitos.',
  }),
});

interface PixData {
  qrcode_text: string;
  qrcode_image_url: string;
}

export function CheckoutModal({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'Código Pix copiado para a área de transferência.' });
  };

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    if (!user?.email) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
      return;
    }

    setLoading(true);
    setPixData(null);

    try {
      const result = await createPixPayment({
        plan: data.plan,
        email: user.email,
        phone: data.phone,
      });

      if (result.error || !result.qrcode_text) {
        throw new Error(result.error || 'Não foi possível gerar o Pix. Tente novamente.');
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
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-sm border-primary/20 font-body">
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            resetState();
        }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-sm border-primary/20 font-body">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl text-primary">Plano de Assinatura</DialogTitle>
          <DialogDescription>
            {pixData ? 'Escaneie o QR Code ou copie o código para pagar.' : 'Escolha um plano e insira seu telefone para continuar.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader className="h-10 w-10 text-primary" />
            </div>
          ) : pixData ? (
            <div className="flex flex-col items-center gap-4">
               <Image src={pixData.qrcode_image_url} alt="QR Code Pix" width={250} height={250} className="rounded-md border-2 border-primary" />
               <div className="w-full p-3 bg-muted/50 rounded-md flex items-center gap-2 border border-input">
                  <p className="truncate text-sm flex-grow">{pixData.qrcode_text}</p>
                  <Button variant="ghost" size="icon" onClick={() => handleCopyToClipboard(pixData.qrcode_text)}>
                      <ClipboardCopy className="h-4 w-4" />
                  </Button>
               </div>
               <p className="text-xs text-center text-muted-foreground">Após o pagamento, o acesso será liberado automaticamente em alguns instantes.</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="plan"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-4"
                        >
                          {Object.values(products).map((product) => (
                             <div key={product.id}>
                                <FormLabel className="text-foreground font-semibold">{product.name}</FormLabel>
                                <div className="space-y-2 mt-2">
                                  {product.plans.map(plan => (
                                    <FormItem key={plan.id} className="flex items-center space-x-3 space-y-0 p-3 rounded-md border border-input has-[:checked]:border-primary transition-all">
                                        <FormControl>
                                        <RadioGroupItem value={plan.id} />
                                        </FormControl>
                                        <FormLabel className="font-normal flex-grow cursor-pointer">
                                        {plan.name} - R${plan.price.toFixed(2).replace('.',',')}
                                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                                        </FormLabel>
                                    </FormItem>
                                  ))}
                                </div>
                             </div>
                          ))}
                        </RadioGroup>
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
                      <FormLabel>Telefone (com DDD)</FormLabel>
                      <FormControl>
                        <Input placeholder="(99) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  Gerar Pagamento Pix
                </Button>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
