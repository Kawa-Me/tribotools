'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Module, Lesson } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

export function ModuleEditor() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'modules'), (snapshot) => {
      const modulesData: Module[] = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Module))
        .sort((a, b) => (a.title > b.title ? 1 : -1)); // Simple sort
      setModules(modulesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleModuleChange = (moduleId: string, field: keyof Module, value: any) => {
    setModules((prevModules) =>
      prevModules.map((mod) =>
        mod.id === moduleId ? { ...mod, [field]: value } : mod
      )
    );
  };

  const handleLessonChange = (
    moduleId: string,
    lessonId: string,
    field: keyof Lesson,
    value: any
  ) => {
    setModules((prevModules) =>
      prevModules.map((mod) =>
        mod.id === moduleId
          ? {
              ...mod,
              lessons: mod.lessons.map((lesson) =>
                lesson.id === lessonId ? { ...lesson, [field]: value } : lesson
              ),
            }
          : mod
      )
    );
  };
  
  const handleSaveChanges = async (module: Module) => {
    if (!db) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviço de banco de dados indisponível.' });
        return;
    }
    try {
      const moduleRef = doc(db, 'modules', module.id);
      await setDoc(moduleRef, { ...module }, { merge: true });
      toast({ title: 'Sucesso!', description: `Módulo "${module.title}" salvo.` });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar o módulo.' });
    }
  };
  
  const handleAddNewModule = async () => {
    if (!db) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviço de banco de dados indisponível.' });
        return;
    }
    const newId = doc(collection(db, 'modules')).id;
    const newModule: Module = {
      id: newId,
      title: 'Novo Módulo',
      description: 'Descrição do novo módulo.',
      icon: 'LayoutDashboard', // Placeholder, ideally a selector
      lessons: [],
    };
    try {
      await setDoc(doc(db, 'modules', newId), newModule);
      toast({ title: 'Sucesso!', description: 'Novo módulo adicionado.' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível adicionar o módulo.' });
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!db) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviço de banco de dados indisponível.' });
        return;
    }
    if (!window.confirm("Tem certeza que deseja deletar este módulo? Esta ação não pode ser desfeita.")) return;
    try {
        await deleteDoc(doc(db, "modules", moduleId));
        toast({ title: 'Sucesso!', description: 'Módulo deletado.' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível deletar o módulo.' });
    }
  }

  const handleAddNewLesson = (moduleId: string) => {
     setModules((prevModules) =>
      prevModules.map((mod) =>
        mod.id === moduleId
          ? {
              ...mod,
              lessons: [
                ...mod.lessons,
                {
                  id: `lesson-${Date.now()}`,
                  title: 'Nova Lição',
                  type: 'text',
                  content: 'Conteúdo da nova lição.',
                },
              ],
            }
          : mod
      )
    );
  };

  const handleDeleteLesson = (moduleId: string, lessonId: string) => {
     setModules((prevModules) =>
      prevModules.map((mod) =>
        mod.id === moduleId
          ? {
              ...mod,
              lessons: mod.lessons.filter((lesson) => lesson.id !== lessonId),
            }
          : mod
      )
    );
  }


  if (loading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
        </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleAddNewModule}>
        <PlusCircle className="mr-2" />
        Adicionar Novo Módulo
      </Button>
      {modules.length === 0 && !loading && (
          <div className="text-center text-muted-foreground mt-8">
              {db ? 'Nenhum módulo encontrado. Adicione um novo para começar.' : 'Serviço de banco de dados não disponível.'}
          </div>
      )}
      <Accordion type="single" collapsible className="w-full">
        {modules.map((mod) => (
          <AccordionItem value={mod.id} key={mod.id}>
            <AccordionTrigger className="hover:no-underline">
                <div className="flex justify-between items-center w-full pr-4">
                    <span>{mod.title}</span>
                    <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); handleDeleteModule(mod.id)}} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 p-4 border rounded-md bg-muted/20">
                <Input
                  value={mod.title}
                  onChange={(e) => handleModuleChange(mod.id, 'title', e.target.value)}
                  placeholder="Título do Módulo"
                />
                <Textarea
                  value={mod.description}
                  onChange={(e) =>
                    handleModuleChange(mod.id, 'description', e.target.value)
                  }
                  placeholder="Descrição do Módulo"
                />
                
                <h4 className="font-semibold mt-4">Lições</h4>
                <div className="space-y-3">
                    {mod.lessons.map((lesson, index) => (
                        <div key={lesson.id} className="p-3 border rounded bg-background space-y-2">
                             <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">Lição {index + 1}</span>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteLesson(mod.id, lesson.id)} className="text-destructive hover:text-destructive/80">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                             </div>
                            <Input value={lesson.title} onChange={(e) => handleLessonChange(mod.id, lesson.id, 'title', e.target.value)} placeholder="Título da lição" />
                            <Textarea value={lesson.content} onChange={(e) => handleLessonChange(mod.id, lesson.id, 'content', e.target.value)} placeholder="Conteúdo (URL do vídeo ou texto em markdown)" />
                        </div>
                    ))}
                </div>

                <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={() => handleAddNewLesson(mod.id)}>Adicionar Lição</Button>
                    <Button onClick={() => handleSaveChanges(mod)}>Salvar Módulo</Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
