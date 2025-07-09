import { Logo } from '@/components/logo';
import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main 
      className="relative flex min-h-screen flex-col items-center justify-center p-4"
    >
      <Image
        src="https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//tribo-tools-capa_252ed5e84019448e948f1947ba80a2cd.png"
        alt="Fundo com temática hacker"
        fill
        className="object-cover -z-10"
        priority
        quality={80}
      />
      <div className="absolute inset-0 bg-black/70 -z-10" />
      <div className="absolute top-8 left-8 z-10">
          <Logo />
      </div>
      <div className="w-full max-w-md z-10">{children}</div>
    </main>
  );
}
