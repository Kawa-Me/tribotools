'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Check, Lock } from 'lucide-react';
import type { Lesson } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ToolCardProps {
  lesson: Lesson;
  moduleId: string;
  isLocked: boolean;
}

export function ToolCard({ lesson, moduleId, isLocked }: ToolCardProps) {
  const isUnlocked = !isLocked;

  return (
    <Link href={isUnlocked ? `/dashboard/module/${moduleId}/lesson/${lesson.id}` : '#'} className={cn(!isUnlocked && 'pointer-events-none group')}>
      <Card className="h-full bg-card backdrop-blur-sm border transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 overflow-hidden relative group">
        <CardContent className="p-0">
          <div className="aspect-[3/4] relative">
            <Image
              src={lesson.imageUrl || "https://placehold.co/400x533.png"}
              data-ai-hint="shark hacker"
              alt={lesson.title}
              fill
              className={cn(
                "object-cover group-hover:scale-105 transition-transform duration-300",
                isLocked && "grayscale"
              )}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            {isLocked && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
                    <Lock className="h-8 w-8 text-destructive" />
                </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-2 absolute bottom-0 w-full bg-gradient-to-t from-black/90 to-transparent">
          <p className="font-semibold text-sm text-white flex items-center justify-center gap-2 w-full">
            <span>{lesson.title}</span>
            {isUnlocked && (
              <>
                <span>-</span>
                <span className="text-green-400 flex items-center gap-1">
                  ON <Check className="h-4 w-4" />
                </span>
              </>
            )}
          </p>
        </CardFooter>
      </Card>
    </Link>
  );
}
