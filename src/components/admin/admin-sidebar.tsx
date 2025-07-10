'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { Users, BookOpen, Shield, Package, TicketPercent, CreditCard, Webhook, Handshake, WalletCards } from 'lucide-react';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Shield },
  { href: '/admin/users', label: 'Usuários', icon: Users },
  { href: '/admin/modules', label: 'Módulos', icon: BookOpen },
  { href: '/admin/plans', label: 'Planos', icon: Package },
  { href: '/admin/coupons', label: 'Cupons', icon: TicketPercent },
  { href: '/admin/affiliates', label: 'Afiliados', icon: Handshake },
  { href: '/admin/commissions', label: 'Comissões', icon: WalletCards },
  { href: '/admin/payments', label: 'Pagamentos', icon: CreditCard },
  { href: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
];

export function AdminSidebar() {
    const pathname = usePathname();
  
    return (
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-[140px] items-center justify-center border-b px-4 lg:px-6">
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
