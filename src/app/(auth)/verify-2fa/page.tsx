'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from '@/components/loader';
import { Label } from '@/components/ui/label';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
    grecaptcha?: any;
  }
}

export default function Verify2FAPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin' || user.isAnonymous) {
        toast({
            variant: 'destructive',
            title: 'Acesso Negado',
            description: 'Esta página é apenas para administradores.',
        });
        router.replace('/login');
      }
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    if (!auth || !recaptchaContainerRef.current) return;
    
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'normal',
        callback: (response: any) => {
          console.log('reCAPTCHA solved, ready to send SMS.');
          toast({ title: "reCAPTCHA Verificado", description: "Pode enviar o código SMS."});
        },
        'expired-callback': () => {
          toast({ variant: 'destructive', title: "reCAPTCHA Expirou", description: "Por favor, verifique novamente."});
        }
      });
      window.recaptchaVerifier.render();
    }

  }, [user, authLoading, toast]);

  const resetRecaptcha = () => {
    if (window.recaptchaVerifier) {
      // In complex scenarios, it might be necessary to clear and re-render.
      // For now, we rely on the render call itself to handle reset.
      window.recaptchaVerifier.render().catch(err => {
          console.error("recaptcha render/reset error:", err);
      });
    }
  }

  const handleSendCode = async () => {
    if (!user?.phone || !window.recaptchaVerifier) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Número de telefone do admin não encontrado ou reCAPTCHA não iniciado.',
      });
      return;
    }

    setLoading(true);
    try {
      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        user.phone,
        appVerifier
      );
      window.confirmationResult = confirmationResult;
      setVerificationId(confirmationResult);
      toast({
        title: 'Código Enviado',
        description: `Um código de verificação foi enviado para ${user.phone}.`,
      });
    } catch (error: any) {
      console.error('SMS send error:', error);
       toast({
        variant: 'destructive',
        title: 'Erro ao Enviar Código',
        description: `Não foi possível enviar o SMS. Verifique o console para detalhes. (${error.code})`,
      });
      resetRecaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, envie um código primeiro.' });
      return;
    }

    setLoading(true);
    try {
      await verificationId.confirm(code);
      toast({
        title: 'Sucesso!',
        description: 'Verificação concluída. Bem-vindo, Admin!',
      });
      router.push('/admin');
    } catch (error: any) {
      console.error('Code verification error:', error);
      toast({
        variant: 'destructive',
        title: 'Código Inválido',
        description: 'O código inserido está incorreto. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };
  
  if (authLoading || !user) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader className="h-10 w-10 text-primary" />
        </div>
    );
  }

  return (
    <>
      <Card className="bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Verificação de Dois Fatores</CardTitle>
          <CardDescription>
            Para sua segurança, precisamos confirmar sua identidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!verificationId ? (
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-sm text-muted-foreground text-center">
                Primeiro, complete o desafio reCAPTCHA abaixo. Depois, clique para enviar o código SMS.
              </p>
              <div id="recaptcha-container" ref={recaptchaContainerRef} className="my-4"></div>
              <Button onClick={handleSendCode} disabled={loading} className="w-full">
                {loading && <Loader className="mr-2" />}
                Enviar Código SMS
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification-code">Código de Verificação</Label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                />
              </div>
              <Button onClick={handleVerifyCode} disabled={loading || code.length < 6} className="w-full">
                 {loading && <Loader className="mr-2" />}
                Verificar e Acessar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
