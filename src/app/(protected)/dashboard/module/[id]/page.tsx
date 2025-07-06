'use client';

import { useAuth } from '@/lib/hooks';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, PlayCircle, FileText } from 'lucide-react';
import { useEffect, useState, use } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Module } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import * as lucideIcons from 'lucide-react';
import { CheckoutModal } from '@/components/checkout-modal';
import Link from 'next/link';

const iconComponents: { [key: string]: React.ComponentType<any> } = {
    LayoutDashboard: lucideIcons.LayoutDashboard,
    BookOpen: lucideIcons.BookOpen,
    Users: lucideIcons.Users,
    Settings: lucideIcons.Settings,
    ShieldCheck: lucideIcons.ShieldCheck,
    KeyRound: lucideIcons.KeyRound,
    SearchCode: lucideIcons.SearchCode,
    BrainCircuit: lucideIcons.BrainCircuit,
    Paintbrush: lucideIcons.Paintbrush,
    TrendingUp: lucideIcons.TrendingUp,
  };

export default function ModulePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useAuth();
  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
        if (!db) {
            setLoading(false);
            return;
        }
        const fetchModule = async () => {
            const docRef = doc(db, 'modules', params.id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const iconName = data.icon as keyof typeof iconComponents;
                const icon = iconComponents[iconName] || lucideIcons.HelpCircle;
                setModule({ id: docSnap.id, ...data, icon } as Module);
            } else {
                notFound();
            }
            setLoading(false);
        };

        fetchModule();
    }
  }, [params.id]);

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
    if (!db) {
        return <p className="text-destructive">Erro: Serviço de banco de dados não configurado.</p>
    }
    return notFound();
  }

  const isUnlocked = user?.subscription?.status === 'active' || user?.role === 'admin';

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold font-headline">{module.title}</h1>
        <p className="text-lg text-muted-foreground">{module.description}</p>
      </header>

      {!isUnlocked ? (
        <LockedContent />
      ) : (
        <div className="space-y-4">
          {module.lessons.map((lesson) => (
            <Card key={lesson.id} className="bg-card/60 backdrop-blur-sm border-white/10">
              <CardContent className="p-4 flex items-center gap-4">
                {lesson.type === 'video' ? (
                  <PlayCircle className="h-8 w-8 text-primary flex-shrink-0" />
                ) : (
                  <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                )}
                <div className="flex-grow">
                  <h3 className="font-semibold">{lesson.title}</h3>
                  <p className="text-sm text-muted-foreground">{lesson.type === 'video' ? 'Vídeo' : 'Texto'}</p>
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

function LockedContent() {
  return (
    <Card className="bg-destructive/10 border-destructive/50 text-center">
      <CardHeader>
        <div className="mx-auto bg-destructive/20 p-4 rounded-full w-fit">
          <Lock className="h-12 w-12 text-destructive" />
        </div>
        <CardTitle className="font-headline text-2xl mt-4">Acesso Bloqueado</CardTitle>
        <CardDescription className="text-destructive-foreground/80">
          Este módulo é exclusivo para membros com uma assinatura ativa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          Faça o upgrade do seu plano para desbloquear este e todos os outros módulos,
          e tenha acesso total a todos os recursos da plataforma.
        </p>
        <CheckoutModal>
          <Button size="lg" variant="destructive">Fazer Upgrade Agora</Button>
        </CheckoutModal>
      </CardContent>
    </Card>
  );
}
