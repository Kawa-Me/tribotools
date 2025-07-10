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
    // Redirect non-admins or unauthenticated users away from this page
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
    
    // Setup reCAPTCHA
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'invisible',
        callback: (response: any) => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
          console.log('reCAPTCHA solved');
        },
      });
    }

    return () => {
        // Cleanup reCAPTCHA on component unmount
        window.recaptchaVerifier?.clear();
    };
  }, []);

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
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        user.phone,
        window.recaptchaVerifier
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
        description: `Não foi possível enviar o SMS. (${error.code})`,
      });
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
      <div id="recaptcha-container" ref={recaptchaContainerRef}></div>
      <Card className="bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Verificação de Dois Fatores</CardTitle>
          <CardDescription>
            Para sua segurança, precisamos confirmar sua identidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!verificationId ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Enviaremos um código de uso único via SMS para o número de telefone associado a esta conta de administrador.
              </p>
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
