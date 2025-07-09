'use client';

import { use } from 'react';
import { notFound, useRouter } from 'next/navigation';
import type { Lesson } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useModules } from '@/hooks/use-modules';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Video, FileText, ClipboardCopy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LessonPage({ params: paramsPromise }: { params: Promise<{ id: string; lessonId: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { modules, loading } = useModules();
  const { toast } = useToast();

  const module = modules.find(m => m.id === params.id);
  const lesson = module?.lessons.find(l => l.id === params.lessonId);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} foi copiado para a área de transferência.` });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!lesson || !module) {
    return notFound();
  }

  const moduleTitle = module.title;

  return (
    <div className="space-y-6">
      <header>
        <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-4 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para {moduleTitle}
        </Button>
        <h1 className="text-4xl font-bold font-headline">{lesson.title}</h1>
        <p className="text-lg text-muted-foreground flex items-center gap-2 mt-2">
          {lesson.type === 'video' ? <Video className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
          {lesson.type === 'video' ? 'Vídeo' : 'Acesso a Ferramenta'}
        </p>
      </header>
      
      {lesson.type === 'video' ? (
        <Card className="bg-card/60 backdrop-blur-sm border-border">
            <CardContent className="p-6">
                <div className="aspect-video">
                <iframe
                    className="w-full h-full rounded-md"
                    src={lesson.content}
                    title={lesson.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
                </div>
            </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
            <Card className="bg-card/60 backdrop-blur-sm border-border">
                <CardContent className="p-6 space-y-4">
                    {lesson.accessUrl && (
                        <Button asChild size="lg" className="w-full">
                            <a href={lesson.accessUrl} target="_blank" rel="noopener noreferrer">
                            {lesson.buttonText || 'Acessar Ferramenta'}
                            <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                    )}
                    <div className="space-y-4">
                        {lesson.accessEmail && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border-2 border-primary/20 bg-muted/30 p-4 transition-colors gap-4 shadow-lg shadow-primary/5">
                                <div>
                                    <p className="font-headline text-lg text-primary">Email / Usuário</p>
                                    <p className="font-mono text-sm text-foreground break-all">{lesson.accessEmail}</p>
                                </div>
                                <Button size="lg" className="w-full sm:w-auto flex-shrink-0" onClick={() => handleCopy(lesson.accessEmail!, 'Email / Usuário')}>
                                    <ClipboardCopy />
                                    Copiar Email
                                </Button>
                            </div>
                        )}
                        {lesson.accessPassword && (
                             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border-2 border-primary/20 bg-muted/30 p-4 transition-colors gap-4 shadow-lg shadow-primary/5">
                                <div>
                                    <p className="font-headline text-lg text-primary">Senha</p>
                                    <p className="font-mono text-sm text-foreground">••••••••</p>
                                </div>
                                <Button size="lg" className="w-full sm:w-auto flex-shrink-0" onClick={() => handleCopy(lesson.accessPassword!, 'Senha')}>
                                    <ClipboardCopy />
                                    Copiar Senha
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {lesson.cookies && lesson.cookies.length > 0 && (
              <Card className="bg-card/60 backdrop-blur-sm border-border">
                <CardHeader className="p-6 pb-2">
                    <CardTitle className="font-headline text-lg text-primary">Cookies de Acesso</CardTitle>
                    <CardDescription>Copie o cookie e cole em sua extensão.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  {lesson.cookies.map((cookie, index) => (
                      <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border-2 border-primary/20 bg-muted/30 p-4 transition-colors gap-4 shadow-lg shadow-primary/5">
                          <div>
                              <p className="font-headline text-lg text-primary">{cookie.name}</p>
                              <p className="text-sm text-muted-foreground">Clique no botão ao lado para copiar o cookie.</p>
                          </div>
                          <Button size="lg" className="w-full sm:w-auto flex-shrink-0" onClick={() => handleCopy(cookie.value, cookie.name)} aria-label={`Copiar ${cookie.name}`}>
                              <ClipboardCopy />
                              Copiar Cookie
                          </Button>
                      </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {lesson.content && (
                <Card className="bg-card/60 backdrop-blur-sm border-border">
                    <CardContent className="p-6">
                        <h3 className="font-headline text-lg mb-4 text-primary">Notas Adicionais</h3>
                        <article className="prose dark:prose-invert max-w-none prose-p:text-foreground/90 prose-a:text-accent prose-strong:text-foreground">
                            <ReactMarkdown>{lesson.content}</ReactMarkdown>
                        </article>
                    </CardContent>
                </Card>
            )}
        </div>
      )}
    </div>
  );
}
