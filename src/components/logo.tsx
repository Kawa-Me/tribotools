import { cn } from '@/lib/utils';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//tribo-logo.png"
        alt="Tribo Tools Logo"
        width={160}
        height={29}
        priority
      />
    </div>
  );
}
