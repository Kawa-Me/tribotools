'use client';

import { useEffect, useState, use } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Module, Lesson } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Video, FileText, ClipboardCopy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent } from '@/components/ui/card';

function InfoField({ label, value, isPassword = false }: { label: string, value: string, isPassword?: boolean }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência.` });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 transition-colors">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm text-foreground">{isPassword ? '••••••••' : value}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={handleCopy} aria-label={`Copiar ${label}`}>
        <ClipboardCopy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function LessonPage({ params: paramsPromise }: { params: Promise<{ id: string; lessonId: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id && params.lessonId) {
      if (!db) {
        setLoading(false);
        return;
      }
      const fetchLesson = async () => {
        const docRef = doc(db, 'modules', params.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const moduleData = docSnap.data() as Omit<Module, 'id' | 'icon'>;
          setModuleTitle(moduleData.title);
          const currentLesson = moduleData.lessons.find(l => l.id === params.lessonId);
          if (currentLesson) {
            setLesson(currentLesson);
          } else {
            notFound();
          }
        } else {
          notFound();
        }
        setLoading(false);
      };

      fetchLesson();
    }
  }, [params.id, params.lessonId]);

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

  if (!lesson) {
    if (!db) {
        return <p className="text-destructive">Erro: Serviço de banco de dados não configurado.</p>
    }
    return notFound();
  }

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
        <Card className="bg-card/60 backdrop-blur-sm border-white/10">
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
            <Card className="bg-card/60 backdrop-blur-sm border-white/10">
                <CardContent className="p-6 space-y-4">
                    {lesson.accessUrl && (
                        <Button asChild size="lg" className="w-full">
                            <a href={lesson.accessUrl} target="_blank" rel="noopener noreferrer">
                            {lesson.buttonText || 'Acessar Ferramenta'}
                            <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                    )}
                    <div className="space-y-2">
                        {lesson.accessEmail && <InfoField label="Email / Usuário" value={lesson.accessEmail} />}
                        {lesson.accessPassword && <InfoField label="Senha" value={lesson.accessPassword} isPassword />}
                    </div>
                </CardContent>
            </Card>

            {lesson.content && (
                <Card className="bg-card/60 backdrop-blur-sm border-white/10">
                    <CardContent className="p-6">
                        <h3 className="font-headline text-lg mb-4 text-primary">Notas Adicionais</h3>
                        <article className="prose prose-invert max-w-none prose-p:text-foreground/90 prose-a:text-accent prose-strong:text-foreground">
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
