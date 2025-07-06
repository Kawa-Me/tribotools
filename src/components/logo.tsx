import { cn } from '@/lib/utils';

// Custom SharkIcon component using an inline SVG, as 'Shark' is not in lucide-react.
// This ensures the logo aligns with the brand identity.
function SharkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M21.74,9.48a6.76,6.76,0,0,0-12.87.56c0,2.44,1.28,4.61,3.22,5.85a1,1,0,0,0,1.3-.39l3.5-5.25a1,1,0,0,1,1.72,0l3.5,5.25a1,1,0,0,0,1.3.39c1.94-1.24,3.22-3.41,3.22-5.85A6.68,6.68,0,0,0,21.74,9.48Z" />
    </svg>
  );
}


export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <SharkIcon className="h-7 w-7 text-primary" />
      <h1 className="text-2xl font-bold font-headline text-foreground">
        Tribo Tools
      </h1>
    </div>
  );
}
