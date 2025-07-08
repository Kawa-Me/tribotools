'use client';

import { createContext, useEffect, useState, ReactNode } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Module, Lesson } from '@/lib/types';
import * as lucideIcons from 'lucide-react';
import { useAuth } from '@/lib/hooks';

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
  MessageSquare: lucideIcons.MessageSquare,
};

interface ModulesContextType {
    modules: Module[];
    loading: boolean;
    dbConfigured: boolean;
}

export const ModulesContext = createContext<ModulesContextType | undefined>(undefined);

export function ModulesProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbConfigured, setDbConfigured] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    if (!db) {
      setLoading(false);
      setDbConfigured(false);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, "modules"), (snapshot) => {
      const modulesData = snapshot.docs
        .map(doc => {
            const data = doc.data();
            const iconName = data.icon as keyof typeof iconComponents;
            const icon = iconComponents[iconName] || lucideIcons.HelpCircle;
            return { 
              id: doc.id, 
              ...data,
              lessons: (data.lessons || []).sort((a: Lesson, b: Lesson) => (a.order ?? 0) - (b.order ?? 0)),
              icon,
              order: data.order ?? 0,
              permission: data.permission || 'ferramentas',
            } as Module;
        })
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      setModules(modulesData);
      setLoading(false);
    }, (error) => {
        console.error("Firestore snapshot error in useModules:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  const value = { modules, loading, dbConfigured };

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}
