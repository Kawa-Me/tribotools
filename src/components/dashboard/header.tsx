'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useModules } from '@/hooks/use-modules';
import { useAuth } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Handshake } from 'lucide-react';
import { SubscriptionCard } from '@/components/dashboard/subscription-card';
import { ThemeToggle } from '../theme-toggle';

export function Header() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { modules, dbConfigured } = useModules();
  
    return (
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 shadow-md backdrop-blur-sm lg:h-[60px] lg:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col bg-background p-0">
            <SheetHeader className="p-6 pb-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Navegue pelo painel do usuário.</SheetDescription>
            </SheetHeader>
            <Link
              href="/dashboard"
              className="flex h-24 items-center justify-center gap-2 border-b text-lg font-semibold lg:h-32"
            >
              <Logo />
            </Link>
            <nav className="flex-1 grid gap-2 text-lg font-medium p-4 overflow-y-auto">
               {!dbConfigured && (
                  <p className="p-4 text-sm text-destructive">
                      Erro: DB não configurado.
                  </p>
                )}
              {modules.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/dashboard/module/${mod.id}`}
                  className={cn(
                    'flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground',
                     pathname.startsWith(`/dashboard/module/${mod.id}`) && 'bg-muted text-foreground'
                  )}
                >
                  <mod.icon className="h-5 w-5" />
                  {mod.title}
                </Link>
              ))}

              {!user?.isAnonymous && (
                 <Link
                    href="/dashboard/affiliate"
                    className={cn(
                      'flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground',
                      pathname === '/dashboard/affiliate' && 'bg-muted text-foreground'
                    )}
                  >
                    <Handshake className="h-5 w-5" />
                    Painel de Afiliado
                  </Link>
              )}
            </nav>
            <div className="mt-auto p-4 border-t">
                <SubscriptionCard />
            </div>
          </SheetContent>
        </Sheet>
  
        <div className="w-full flex-1">
          {/* Can add search bar here if needed */}
        </div>
        <ThemeToggle />
        <UserNav />
      </header>
    );
  }
