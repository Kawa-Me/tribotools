'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Check, Lock } from 'lucide-react';
import type { Lesson } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ToolCardProps {
  lesson: Lesson;
  moduleId: string;
  isLocked: boolean;
}

export function ToolCard({ lesson, moduleId, isLocked }: ToolCardProps) {
  const isUnlocked = !isLocked;

  const cardContent = (
    <Card
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-md border-2 border-transparent bg-[#111111] transition-all duration-300',
        isUnlocked && 'hover:border-neon-green hover:shadow-lg hover:shadow-neon-green/10'
      )}
    >
      <div className="relative w-full aspect-[3/4]">
        <Image
          src={lesson.imageUrl || 'https://placehold.co/400x533.png'}
          alt={lesson.title}
          fill
          loading="lazy"
          className="object-cover transition-transform duration-300 group-hover:scale-105 rounded-t-md"
        />
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-t-md">
            <Lock className="h-8 w-8 text-white" />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center justify-center p-4 text-center">
        <h3 className="font-bold text-white">{lesson.title}</h3>
        {isUnlocked && (
          <div className="mt-1 flex items-center gap-1 text-xs font-bold text-neon-green">
            <span>ATIVO</span>
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <Link 
      href={isUnlocked ? `/dashboard/module/${moduleId}/lesson/${lesson.id}` : '#'} 
      className={cn(!isUnlocked && 'pointer-events-none cursor-not-allowed')}
      aria-label={lesson.title}
    >
      {cardContent}
    </Link>
  );
}
