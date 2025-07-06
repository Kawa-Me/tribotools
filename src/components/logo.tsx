import { cn } from '@/lib/utils';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Image
        src="https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//tribo-logo.png"
        alt="Tribo Tools Logo"
        width={120}
        height={120}
        priority
        className="object-contain max-h-[100px] max-w-[100px]"
      />
    </div>
  );
}
