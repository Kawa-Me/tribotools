'use client';

import { useAuth } from '@/lib/hooks';
import { modules } from '@/data/modules';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Lock, PlayCircle, FileText } from 'lucide-react';

export default function ModulePage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const module = modules.find((m) => m.id === params.id);

  if (!module) {
    notFound();
  }

  const isUnlocked = user?.subscription?.status === 'active';

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
                <Button>Acessar</Button>
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
        <Button size="lg" variant="destructive">Fazer Upgrade Agora</Button>
      </CardContent>
    </Card>
  );
}
