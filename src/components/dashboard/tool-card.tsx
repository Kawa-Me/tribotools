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
        'group relative flex h-[240px] w-full flex-col overflow-hidden rounded-md border-2 border-transparent bg-[#111111] transition-all duration-300',
        isUnlocked && 'hover:border-neon-green hover:shadow-neon-glow'
      )}
    >
      <div className="relative h-3/5 w-full">
        <Image
          src={lesson.imageUrl || 'https://placehold.co/400x240.png'}
          alt={lesson.title}
          fill
          loading="lazy"
          className="object-cover"
        />
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
            <Lock className="h-8 w-8 text-white" />
          </div>
        )}
      </div>

      <div className="flex flex-grow flex-col items-center justify-center p-2 text-center">
        <h3 className="text-md font-bold text-white">{lesson.title}</h3>
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
      className={cn(!isUnlocked && 'pointer-events-none')}
      aria-label={lesson.title}
    >
      {cardContent}
    </Link>
  );
}
