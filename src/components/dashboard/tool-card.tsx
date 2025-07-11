'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Check, Lock, Wrench, Rocket } from 'lucide-react';
import type { Lesson } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ToolCardProps {
  lesson: Lesson;
  moduleId: string;
  isLocked: boolean;
}

export function ToolCard({ lesson, moduleId, isLocked }: ToolCardProps) {
  const isUnlocked = !isLocked;
  // If status is undefined (for older data), default to 'active'.
  const toolStatus = lesson.status ?? 'active';
  const canAccess = isUnlocked && toolStatus === 'active';

  const renderBadge = () => {
    if (!isUnlocked) return null;

    switch (toolStatus) {
      case 'active':
        return (
          <Badge variant="outline" className="mt-2 border-primary/50 bg-primary/10 text-primary">
            <Check className="mr-1 h-3 w-3" />
            ON
          </Badge>
        );
      case 'maintenance':
        return (
          <Badge variant="destructive" className="mt-2">
            <Wrench className="mr-1 h-3 w-3" />
            MANUTENÇÃO
          </Badge>
        );
      case 'coming_soon':
        return (
          <Badge variant="secondary" className="mt-2 border-purple-500/50 bg-purple-500/10 text-purple-400">
            <Rocket className="mr-1 h-3 w-3" />
            EM BREVE
          </Badge>
        );
      default:
        return null;
    }
  };

  const cardContent = (
    <Card
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-md border-2 bg-card/60 transition-all duration-300',
        canAccess ? 'border-transparent hover:border-primary hover:shadow-lg hover:shadow-primary/20' : 'border-transparent',
        isUnlocked && toolStatus !== 'active' && 'opacity-60 cursor-not-allowed'
      )}
    >
      <div className="relative w-full aspect-[4/5]">
        <Image
          src={lesson.imageUrl || 'https://placehold.co/400x500.png'}
          alt={lesson.title}
          fill
          loading="lazy"
          className="object-cover transition-transform duration-300 group-hover:scale-105 rounded-t-md"
        />
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-t-md">
            <Lock className="h-8 w-8 text-foreground" />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center justify-center p-4 text-center">
        <h3 className="font-bold text-foreground">{lesson.title}</h3>
        {renderBadge()}
      </div>
    </Card>
  );

  return (
    <Link 
      href={canAccess ? `/dashboard/module/${moduleId}/lesson/${lesson.id}` : '#'} 
      className={cn(!canAccess && 'pointer-events-none cursor-not-allowed')}
      aria-label={lesson.title}
    >
      {cardContent}
    </Link>
  );
}
