'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Module, Lesson, LessonCookie, Product } from '@/lib/types';
import { seedModules } from '@/data/seed-modules';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useProducts } from '@/hooks/use-products';
import { PlusCircle, Trash2, ArrowUp, ArrowDown, Save, Eye, EyeOff } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks';

export function ModuleEditor() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const { products: availableProducts, loading: productsLoading } = useProducts();
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const availablePermissions = ['public', ...availableProducts.map(p => p.id)];

  useEffect(() => {
    if (authLoading || !user || user.role !== 'admin') {
      if (!authLoading) setLoading(false);
      return;
    }

    if (!db) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'modules'), async (snapshot) => {
      if (snapshot.empty && db) {
        console.log("No modules found. Seeding initial data...");
        setLoading(true);
        try {
          const batch = writeBatch(db);
          seedModules.forEach((moduleData, moduleIndex) => {
            const moduleRef = doc(collection(db, 'modules'));
            const newLessons = moduleData.lessons.map((lesson, lessonIndex) => ({
                ...lesson,
                id: `lesson-${Date.now()}-${Math.random()}`,
                order: lessonIndex,
                cookies: (lesson as any).cookies || [],
            }));
            batch.set(moduleRef, { ...moduleData, lessons: newLessons, order: moduleIndex });
          });
          await batch.commit();
          toast({ title: 'Sucesso!', description: 'Módulos iniciais criados.' });
        } catch (error) {
          console.error("Error seeding modules:", error);
          toast({ variant: 'destructive', title: 'Erro ao criar módulos iniciais.' });
          setLoading(false);
        }
      } else {
        const modulesData: Module[] = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as any))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        modulesData.forEach(mod => {
            mod.lessons = (mod.lessons || []).sort((a: Lesson, b: Lesson) => (a.order ?? 0) - (b.order ?? 0));
        });

        setModules(modulesData);
        setLoading(false);
      }
    }, (error) => {
      console.error("Firestore snapshot error in ModuleEditor:", error);
      toast({ variant: 'destructive', title: 'Erro ao carregar módulos.' });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast, user, authLoading]);
  

  const handleModuleChange = (moduleId: string, field: keyof Omit<Module, 'id' | 'lessons'>, value: any) => {
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

  const handleCookieChange = (moduleId: string, lessonId: string, cookieIndex: number, field: keyof LessonCookie, value: string) => {
    setModules(prevModules => prevModules.map(mod => {
        if (mod.id === moduleId) {
            return {
                ...mod,
                lessons: mod.lessons.map(lesson => {
                    if (lesson.id === lessonId) {
                        const newCookies = [...(lesson.cookies || [])];
                        newCookies[cookieIndex] = { ...newCookies[cookieIndex], [field]: value };
                        return { ...lesson, cookies: newCookies };
                    }
                    return lesson;
                })
            };
        }
        return mod;
    }));
  };

  const handleAddCookie = (moduleId: string, lessonId: string) => {
    setModules(prevModules => prevModules.map(mod => {
        if (mod.id === moduleId) {
            return {
                ...mod,
                lessons: mod.lessons.map(lesson => {
                    if (lesson.id === lessonId) {
                        const newCookies = [...(lesson.cookies || [])];
                        if (newCookies.length < 7) {
                            newCookies.push({ name: `Cookie ${newCookies.length + 1}`, value: '' });
                        }
                        return { ...lesson, cookies: newCookies };
                    }
                    return lesson;
                })
            };
        }
        return mod;
    }));
  };

  const handleDeleteCookie = (moduleId: string, lessonId: string, cookieIndex: number) => {
      setModules(prevModules => prevModules.map(mod => {
          if (mod.id === moduleId) {
              return {
                  ...mod,
                  lessons: mod.lessons.map(lesson => {
                      if (lesson.id === lessonId) {
                          const newCookies = (lesson.cookies || []).filter((_, index) => index !== cookieIndex);
                          const updatedCookies = newCookies.map((cookie, index) => ({
                              ...cookie,
                              name: `Cookie ${index + 1}`
                          }));
                          return { ...lesson, cookies: updatedCookies };
                      }
                      return lesson;
                  })
              };
          }
          return mod;
      }));
  };
  
  const handleSaveAllChanges = async () => {
    if (!db) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviço de banco de dados indisponível.' });
        return;
    }
    try {
      const batch = writeBatch(db);
      modules.forEach(mod => {
          const moduleRef = doc(db, 'modules', mod.id);
          const { icon, ...dataToSave } = mod;
          batch.set(moduleRef, { ...dataToSave, icon: icon, permission: mod.permission || 'ferramentas' });
      });
      await batch.commit();
      toast({ title: 'Sucesso!', description: 'Todas as alterações foram salvas.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar as alterações.' });
    }
  };
  
  const handleAddNewModule = () => {
     const newModule: Module = {
      id: doc(collection(db, 'modules')).id,
      title: 'Novo Módulo',
      description: 'Descrição do novo módulo.',
      icon: 'LayoutDashboard' as any,
      lessons: [],
      order: modules.length,
      permission: 'ferramentas'
    };
    setModules([...modules, newModule]);
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este módulo? Esta ação não pode ser desfeita.")) return;

    // Optimistically update UI
    setModules((prevModules) => prevModules.filter((mod) => mod.id !== moduleId));
    
    if (!db) {
        toast({ variant: 'destructive', title: 'Erro de Conexão', description: 'Serviço de banco de dados indisponível.' });
        return;
    }
    try {
        await deleteDoc(doc(db, "modules", moduleId));
        toast({ title: 'Sucesso!', description: 'Módulo deletado.' });
    } catch (error) {
        console.error("Error deleting module:", error);
        toast({ variant: 'destructive', title: 'Erro ao Deletar', description: 'Não foi possível remover o módulo do servidor. O estado será restaurado.' });
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
                  content: '',
                  imageUrl: '',
                  order: mod.lessons.length,
                  accessUrl: '',
                  buttonText: '',
                  accessEmail: '',
                  accessPassword: '',
                  cookies: [],
                  isActive: true,
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

  const handleMoveModule = (index: number, direction: 'up' | 'down') => {
    const newModules = [...modules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModules.length) return;
    
    [newModules[index], newModules[targetIndex]] = [newModules[targetIndex], newModules[index]];
    
    setModules(newModules.map((m, i) => ({ ...m, order: i })));
  };

  const handleMoveLesson = (moduleId: string, lessonIndex: number, direction: 'up' | 'down') => {
    setModules(modules.map(mod => {
        if (mod.id === moduleId) {
            const newLessons = [...mod.lessons];
            const targetIndex = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1;
            if (targetIndex < 0 || targetIndex >= newLessons.length) return mod;

            [newLessons[lessonIndex], newLessons[targetIndex]] = [newLessons[targetIndex], newLessons[lessonIndex]];
            
            return { ...mod, lessons: newLessons.map((l, i) => ({ ...l, order: i })) };
        }
        return mod;
    }));
  };

  if (loading || productsLoading) {
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
       <div className="flex justify-between items-center">
        <Button onClick={handleAddNewModule}>
            <PlusCircle className="mr-2" />
            Adicionar Novo Módulo
        </Button>
        <Button onClick={handleSaveAllChanges}>
            <Save className="mr-2" />
            Salvar Todas as Alterações
        </Button>
      </div>

      {modules.length === 0 && !loading && (
          <div className="text-center text-muted-foreground mt-8">
              {db ? 'Nenhum módulo encontrado. Adicione um novo para começar.' : 'Serviço de banco de dados não disponível.'}
          </div>
      )}
      <Accordion type="single" collapsible className="w-full">
        {modules.map((mod, index) => (
          <AccordionItem value={mod.id} key={mod.id}>
            <AccordionTrigger className="hover:no-underline">
                <div className="flex justify-between items-center w-full pr-4">
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                            <div
                                role="button"
                                aria-label="Mover módulo para cima"
                                tabIndex={index === 0 ? -1 : 0}
                                className={cn(
                                    buttonVariants({ variant: 'ghost', size: 'icon' }),
                                    'h-6 w-6',
                                    index === 0 && 'pointer-events-none opacity-50'
                                )}
                                onClick={(e) => {
                                    if (index === 0) return;
                                    e.stopPropagation();
                                    handleMoveModule(index, 'up');
                                }}
                                onKeyDown={(e) => {
                                    if (index === 0) return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleMoveModule(index, 'up');
                                    }
                                }}
                                >
                                <ArrowUp className="h-4 w-4" />
                            </div>
                            <div
                                role="button"
                                aria-label="Mover módulo para baixo"
                                tabIndex={index === modules.length - 1 ? -1 : 0}
                                className={cn(
                                    buttonVariants({ variant: 'ghost', size: 'icon' }),
                                    'h-6 w-6',
                                    index === modules.length - 1 && 'pointer-events-none opacity-50'
                                )}
                                onClick={(e) => {
                                    if (index === modules.length - 1) return;
                                    e.stopPropagation();
                                    handleMoveModule(index, 'down');
                                }}
                                onKeyDown={(e) => {
                                    if (index === modules.length - 1) return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleMoveModule(index, 'down');
                                    }
                                }}
                                >
                                <ArrowDown className="h-4 w-4" />
                            </div>
                        </div>
                        <span>{mod.title}</span>
                    </div>
                     <div
                      role="button"
                      aria-label={`Deletar módulo ${mod.title}`}
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteModule(mod.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteModule(mod.id);
                        }
                      }}
                      className={cn(
                        'p-2 rounded-md hover:bg-destructive/20 focus-visible:ring-1 focus-visible:ring-ring text-destructive hover:text-destructive/80'
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 p-4 border rounded-md bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor={`title-${mod.id}`}>Título do Módulo</Label>
                        <Input id={`title-${mod.id}`} value={mod.title} onChange={(e) => handleModuleChange(mod.id, 'title', e.target.value)} placeholder="Título do Módulo" />
                    </div>
                    <div className="space-y-2">
                         <Label htmlFor={`icon-${mod.id}`}>Ícone (Lucide React)</Label>
                         <Input id={`icon-${mod.id}`} value={mod.icon as any} onChange={(e) => handleModuleChange(mod.id, 'icon', e.target.value)} placeholder="Nome do Ícone" />
                    </div>
                    <div className="space-y-2">
                         <Label htmlFor={`permission-${mod.id}`}>Permissão</Label>
                         <Select
                            value={mod.permission}
                            onValueChange={(value) => handleModuleChange(mod.id, 'permission', value)}
                          >
                            <SelectTrigger id={`permission-${mod.id}`}>
                              <SelectValue placeholder="Selecione a permissão" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePermissions.map((perm) => (
                                <SelectItem key={perm} value={perm}>
                                  {availableProducts.find(p => p.id === perm)?.name || perm.charAt(0).toUpperCase() + perm.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`description-${mod.id}`}>Descrição do Módulo</Label>
                    <Textarea id={`description-${mod.id}`} value={mod.description} onChange={(e) => handleModuleChange(mod.id, 'description', e.target.value)} placeholder="Descrição do Módulo" />
                </div>
                
                <h4 className="font-semibold mt-4">Lições</h4>
                <div className="space-y-3">
                    {mod.lessons.map((lesson, lessonIndex) => (
                        <div key={lesson.id} className="p-3 border rounded bg-background space-y-3">
                             <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col">
                                        <div
                                            role="button"
                                            aria-label="Mover lição para cima"
                                            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-6 w-6', lessonIndex === 0 && 'pointer-events-none opacity-50')}
                                            onClick={() => handleMoveLesson(mod.id, lessonIndex, 'up')}>
                                            <ArrowUp className="h-4 w-4" />
                                        </div>
                                        <div
                                            role="button"
                                            aria-label="Mover lição para baixo"
                                            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-6 w-6', lessonIndex === mod.lessons.length - 1 && 'pointer-events-none opacity-50')}
                                            onClick={() => handleMoveLesson(mod.id, lessonIndex, 'down')}>
                                            <ArrowDown className="h-4 w-4" />
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium">Lição {lessonIndex + 1}</span>
                                </div>
                                <div
                                    role="button"
                                    aria-label={`Deletar lição ${lesson.title}`}
                                    onClick={() => handleDeleteLesson(mod.id, lesson.id)}
                                    className={cn('p-2 rounded-md hover:bg-destructive/20 text-destructive hover:text-destructive/80')}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </div>
                             </div>
                            <Input value={lesson.title} onChange={(e) => handleLessonChange(mod.id, lesson.id, 'title', e.target.value)} placeholder="Título da lição" />
                            <Input value={lesson.imageUrl || ''} onChange={(e) => handleLessonChange(mod.id, lesson.id, 'imageUrl', e.target.value)} placeholder="URL da Imagem da Capa" />
                            
                            <div className="flex items-center space-x-2 pt-2 border-t mt-4">
                              <Switch
                                id={`isActive-${lesson.id}`}
                                checked={lesson.isActive ?? true}
                                onCheckedChange={(checked) => handleLessonChange(mod.id, lesson.id, 'isActive', checked)}
                              />
                              <Label htmlFor={`isActive-${lesson.id}`}>Ferramenta Ativa</Label>
                            </div>

                            <div className="space-y-1">
                                <Label>Tipo da Lição</Label>
                                <Select value={lesson.type} onValueChange={(value) => handleLessonChange(mod.id, lesson.id, 'type', value as 'video' | 'text')}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="text">Acesso a Ferramenta</SelectItem>
                                        <SelectItem value="video">Vídeo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {lesson.type === 'video' ? (
                                <Textarea value={lesson.content} onChange={(e) => handleLessonChange(mod.id, lesson.id, 'content', e.target.value)} placeholder="URL de embed do vídeo (ex: https://www.youtube.com/embed/...)" />
                            ) : (
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-2 pt-2 border-t">
                                        <Label className="text-xs text-muted-foreground">Dados de Acesso</Label>
                                        <Input value={lesson.accessUrl || ''} onChange={(e) => handleLessonChange(mod.id, lesson.id, 'accessUrl', e.target.value)} placeholder="URL de Acesso" />
                                        <Input value={lesson.buttonText || ''} onChange={(e) => handleLessonChange(mod.id, lesson.id, 'buttonText', e.target.value)} placeholder="Texto do Botão (ex: Acessar Ferramenta)" />
                                        <Input value={lesson.accessEmail || ''} onChange={(e) => handleLessonChange(mod.id, lesson.id, 'accessEmail', e.target.value)} placeholder="Email / Usuário de Acesso" />
                                        <div className="relative">
                                            <Input
                                                type={showPasswords[lesson.id] ? 'text' : 'password'}
                                                value={lesson.accessPassword || ''}
                                                onChange={(e) => handleLessonChange(mod.id, lesson.id, 'accessPassword', e.target.value)}
                                                placeholder="Senha de Acesso"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                                onClick={() => setShowPasswords(prev => ({...prev, [lesson.id]: !prev[lesson.id]}))}
                                            >
                                                {showPasswords[lesson.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t">
                                        <Label className="text-xs text-muted-foreground">Cookies de Acesso (até 7)</Label>
                                        {(lesson.cookies || []).map((cookie, cookieIndex) => (
                                            <div key={cookieIndex} className="flex items-start gap-2">
                                                <Textarea
                                                    placeholder={`Valor do Cookie ${cookieIndex + 1}`}
                                                    value={cookie.value}
                                                    onChange={(e) => handleCookieChange(mod.id, lesson.id, cookieIndex, 'value', e.target.value)}
                                                    rows={3}
                                                />
                                                <Button variant="destructive" size="icon" className="shrink-0" onClick={() => handleDeleteCookie(mod.id, lesson.id, cookieIndex)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        {(!lesson.cookies || lesson.cookies.length < 7) && (
                                            <Button variant="outline" size="sm" className="mt-2" onClick={() => handleAddCookie(mod.id, lesson.id)}>
                                                <PlusCircle className="mr-2 h-4 w-4" />
                                                Adicionar Cookie
                                            </Button>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-2 pt-2 border-t">
                                        <Label className="text-xs text-muted-foreground">Notas Adicionais</Label>
                                        <Textarea value={lesson.content} onChange={(e) => handleLessonChange(mod.id, lesson.id, 'content', e.target.value)} placeholder="Instruções extras, observações, etc. (Markdown)" />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex justify-start mt-4">
                    <Button variant="outline" onClick={() => handleAddNewLesson(mod.id)}>Adicionar Lição</Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
