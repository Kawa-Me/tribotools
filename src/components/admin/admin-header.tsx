'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Users, BookOpen, Shield, Package, TicketPercent, CreditCard, Webhook, Handshake } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Shield },
  { href: '/admin/users', label: 'Usuários', icon: Users },
  { href: '/admin/modules', label: 'Módulos', icon: BookOpen },
  { href: '/admin/plans', label: 'Planos', icon: Package },
  { href: '/admin/coupons', label: 'Cupons', icon: TicketPercent },
  { href: '/admin/affiliates', label: 'Afiliados', icon: Handshake },
  { href: '/admin/payments', label: 'Pagamentos', icon: CreditCard },
  { href: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
];

export function AdminHeader() {
    const pathname = usePathname();
  
    return (
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 shadow-md backdrop-blur-sm lg:h-[60px] lg:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col bg-background">
            <SheetHeader>
              <SheetTitle className="sr-only">Menu Administrador</SheetTitle>
              <SheetDescription className="sr-only">Navegue pela área de administração.</SheetDescription>
            </SheetHeader>
            <nav className="grid gap-2 text-lg font-medium">
              <Link
                href="/admin"
                className="flex items-center justify-center gap-2 text-lg font-semibold mb-4 h-[140px] border-b"
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
        <ThemeToggle />
        <UserNav />
      </header>
    );
  }
