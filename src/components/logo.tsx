import Image from 'next/image';

export function Logo() {
  return (
    <Image
      src="https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//tribo-logo.png"
      alt="Tribo Tools Logo"
      width={100}
      height={100}
      priority
      className="object-contain"
    />
  );
}
