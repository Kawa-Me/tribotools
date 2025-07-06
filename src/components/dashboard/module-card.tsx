import Link from 'next/link';
import { Lock, Unlock } from 'lucide-react';
import type { Module } from '@/lib/types';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ModuleCardProps {
  module: Module;
  isLocked: boolean;
}

export function ModuleCard({ module, isLocked }: ModuleCardProps) {
  return (
    <Link href={isLocked ? '#' : `/dashboard/module/${module.id}`} className={cn(isLocked && 'pointer-events-none')}>
      <Card className="h-full bg-card/60 backdrop-blur-sm border-white/10 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10 text-primary">
                <module.icon className="h-6 w-6" />
              </div>
              <CardTitle className="font-headline text-lg">{module.title}</CardTitle>
            </div>
            {isLocked ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Lock className="h-3 w-3" /> Bloqueado
              </Badge>
            ) : (
              <Badge variant="default" className="flex items-center gap-1">
                <Unlock className="h-3 w-3" /> Liberado
              </Badge>
            )}
          </div>
          <CardDescription className="pt-2">{module.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
