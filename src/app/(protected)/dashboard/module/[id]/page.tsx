
'use client';

import { useAuth } from '@/lib/hooks';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, PlayCircle, FileText } from 'lucide-react';
import { use } from 'react';
import { useModules } from '@/hooks/use-modules';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckoutModal } from '@/components/checkout-modal';
import Link from 'next/link';

export default function ModulePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useAuth();
  const { modules, loading } = useModules();

  const module = modules.find(m => m.id === params.id);

  if (loading) {
      return (
          <div className="space-y-8">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
              </div>
          </div>
      )
  }

  if (!module) {
    return notFound();
  }

  const isUnlocked = user?.role === 'admin' || module.permission === 'public' || (user?.subscriptions && user.subscriptions[module.permission]?.status === 'active');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold font-headline">{module.title}</h1>
        <p className="text-lg text-muted-foreground">{module.description}</p>
      </header>

      {!isUnlocked ? (
        <LockedContent module={module} />
      ) : (
        <div className="space-y-4">
          {module.lessons.map((lesson) => (
            <Card key={lesson.id} className="bg-card/60 backdrop-blur-sm border-border">
              <CardContent className="p-4 flex items-center gap-4">
                {lesson.type === 'video' ? (
                  <PlayCircle className="h-8 w-8 text-primary flex-shrink-0" />
                ) : (
                  <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                )}
                <div className="flex-grow">
                  <h3 className="font-semibold">{lesson.title}</h3>
                  <p className="text-sm text-muted-foreground">{lesson.type === 'video' ? 'Vídeo' : 'Acesso a Ferramenta'}</p>
                </div>
                <Button asChild>
                  <Link href={`/dashboard/module/${params.id}/lesson/${lesson.id}`}>Acessar</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LockedContent({ module }: { module: Module }) {
  const { user } = useAuth();
  return (
    <Card className="bg-destructive/10 border-destructive/50 text-center">
      <CardHeader>
        <div className="mx-auto bg-destructive/20 p-4 rounded-full w-fit">
          <Lock className="h-12 w-12 text-destructive" />
        </div>
        <CardTitle className="font-headline text-2xl mt-4">Acesso Bloqueado</CardTitle>
        <CardDescription className="text-destructive-foreground/80">
          Este conteúdo é exclusivo para membros com a assinatura do produto "{module.title}" ativa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          {user?.isAnonymous
            ? 'Crie uma conta e adquira o plano para desbloquear este conteúdo.'
            : 'Adquira o plano para desbloquear este módulo e ter acesso total aos seus recursos.'
          }
        </p>
        {user?.isAnonymous ? (
          <Button asChild size="lg" variant="destructive">
            <Link href="/signup">Criar Conta Agora</Link>
          </Button>
        ) : (
          <CheckoutModal>
            <Button size="lg" variant="destructive">Adquirir Acesso</Button>
          </CheckoutModal>
        )}
      </CardContent>
    </Card>
  );
}
