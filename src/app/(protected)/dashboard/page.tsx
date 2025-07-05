'use client';

import { useAuth } from '@/lib/hooks';
import { modules } from '@/data/modules';
import { ModuleCard } from '@/components/dashboard/module-card';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const isUnlocked = user.subscription?.status === 'active';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Bem-vindo(a) de volta!</h1>
        <p className="text-muted-foreground">Continue de onde parou e explore os módulos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <ModuleCard key={module.id} module={module} isLocked={!isUnlocked} />
        ))}
      </div>
    </div>
  );
}
