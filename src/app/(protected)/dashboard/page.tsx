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

  useEffect(() => {
    if (!db) {
      setLoading(false);
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

  const isUnlocked = user.subscription?.status === 'active';

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
