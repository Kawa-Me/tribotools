'use client';

import { useAuth } from '@/lib/hooks';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Module } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import * as lucideIcons from 'lucide-react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ToolCard } from '@/components/dashboard/tool-card';

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

export default function DashboardPage() {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbConfigured, setDbConfigured] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      setDbConfigured(false);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, "modules"), (snapshot) => {
      const modulesData = snapshot.docs.map(doc => {
        const data = doc.data();
        const iconName = data.icon as keyof typeof iconComponents;
        const icon = iconComponents[iconName] || lucideIcons.HelpCircle;
        return { id: doc.id, ...data, icon } as Module;
      });
      setModules(modulesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (!user) return null;

  const isUnlocked = user.role === 'admin' || user.subscription?.status === 'active';

  return (
    <div className="space-y-12">
      {loading ? (
        <div className="space-y-12">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {[...Array(6)].map((_, j) => (
                  <Skeleton key={j} className="aspect-[3/4] w-full rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !dbConfigured ? (
        <Card className="bg-destructive/10 border-destructive/50 text-center p-8">
            <CardTitle className="text-destructive">Erro de Conexão</CardTitle>
            <CardDescription className="text-destructive-foreground/80 mt-2">
                Não foi possível conectar ao banco de dados. Por favor, verifique se o Firestore está ativado e configurado corretamente no seu projeto do Firebase.
            </CardDescription>
        </Card>
      ) : (
        modules.map((module) => (
          <div key={module.id} className="space-y-4">
            <h2 className="text-lg font-bold font-headline flex items-center gap-3 text-primary/90">
                <module.icon className="h-5 w-5" />
                {module.title.toUpperCase()}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {module.lessons.map((lesson) => (
                <ToolCard key={lesson.id} lesson={lesson} moduleId={module.id} isLocked={!isUnlocked} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
