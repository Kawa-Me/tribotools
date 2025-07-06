'use client';

import { useAuth } from '@/lib/hooks';
import { ModuleCard } from '@/components/dashboard/module-card';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Module } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import * as lucideIcons from 'lucide-react';

// A mapping from icon names (as strings) to the actual components
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Bem-vindo(a) de volta!</h1>
        <p className="text-muted-foreground">Continue de onde parou e explore os módulos.</p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>
      ) : !dbConfigured ? (
        <Card className="bg-destructive/10 border-destructive/50 text-center p-8">
            <CardTitle className="text-destructive">Erro de Conexão</CardTitle>
            <CardDescription className="text-destructive-foreground/80 mt-2">
                Não foi possível conectar ao banco de dados. Por favor, verifique se o Firestore está ativado e configurado corretamente no seu projeto do Firebase.
            </CardDescription>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} isLocked={!isUnlocked} />
          ))}
        </div>
      )}
    </div>
  );
}
