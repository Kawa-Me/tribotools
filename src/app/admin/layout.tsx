'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/loader';
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Users, BookOpen, Shield } from 'lucide-react';
import { Rotbar } from '@/components/rotbar';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Shield },
  { href: '/admin/users', label: 'Usuários', icon: Users },
  { href: '/admin/modules', label: 'Módulos', icon: BookOpen },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'admin') {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader className="h-10 w-10 text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <div className="flex flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 lg:p-8">
              {children}
          </main>
        </div>
      </div>
      <Rotbar />
    </>
  );
}

function Sidebar() {
    const pathname = usePathname();
  
    return (
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-[80px] items-center justify-center border-b px-4 lg:px-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <Logo />
              <span className="text-sm font-bold text-primary">(Admin)</span>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              {adminNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                    pathname === item.href && 'bg-muted text-primary'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    );
  }
  
  function Header() {
    const pathname = usePathname();
  
    return (
      <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col bg-background">
          <nav className="grid gap-2 text-lg font-medium">
              <Link
                href="/admin"
                className="flex items-center justify-center gap-2 text-lg font-semibold mb-4 h-[80px] border-b"
              >
                <Logo />
                 <span className="text-sm font-bold text-primary">(Admin)</span>
              </Link>
              {adminNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground',
                     pathname === item.href && 'bg-muted text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
  
        <div className="w-full flex-1">
          {/* Can add search bar here if needed */}
        </div>
        <UserNav />
      </header>
    );
  }
