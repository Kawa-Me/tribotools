'use client';

import { useAuth } from '@/lib/hooks';
import { useModules } from '@/hooks/use-modules';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ToolCard } from '@/components/dashboard/tool-card';

export default function DashboardPage() {
  const { user } = useAuth();
  const { modules, loading, dbConfigured } = useModules();

  if (!user) return null;

  const isUnlocked = user.role === 'admin' || user.subscription?.status === 'active';

  return (
    <div className="space-y-12">
      {loading ? (
        <div className="space-y-12">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-6">
              <Skeleton className="h-8 w-1/3" />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {[...Array(4)].map((_, j) => (
                  <Skeleton key={j} className="h-[240px] w-full rounded-lg" />
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
          (module.lessons && module.lessons.length > 0) && (
            <div key={module.id} className="space-y-6">
              <h2 className="text-2xl font-bold font-headline flex items-center gap-3 text-primary">
                  <module.icon className="h-6 w-6" />
                  {module.title}
              </h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {module.lessons.map((lesson) => (
                  <ToolCard key={lesson.id} lesson={lesson} moduleId={module.id} isLocked={!isLocked} />
                ))}
              </div>
            </div>
          )
        ))
      )}
    </div>
  );
}
