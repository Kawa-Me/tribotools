'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Module, Lesson } from '@/lib/types';
import * as lucideIcons from 'lucide-react';

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

export function useModules() {
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
  }, []);

  return { modules, loading, dbConfigured };
}
