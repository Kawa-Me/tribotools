'use client';

import { useEffect, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Module, Lesson } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Video, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent } from '@/components/ui/card';

export default function LessonPage({ params }: { params: { id: string; lessonId: string } }) {
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
          {lesson.type === 'video' ? 'Vídeo' : 'Material de Texto'}
        </p>
      </header>

      <Card className="bg-card/60 backdrop-blur-sm border-white/10">
        <CardContent className="p-6">
          {lesson.type === 'video' ? (
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
          ) : (
            <article className="prose prose-invert max-w-none prose-headings:text-primary prose-a:text-accent prose-strong:text-foreground prose-p:text-foreground/90">
                 <ReactMarkdown>{lesson.content}</ReactMarkdown>
            </article>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
