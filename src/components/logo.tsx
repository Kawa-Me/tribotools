import { Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Rocket className="h-7 w-7 text-primary" />
      <h1 className="text-2xl font-bold font-headline text-white">
        Membro Forte
      </h1>
    </div>
  );
}
