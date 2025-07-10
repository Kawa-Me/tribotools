'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useModules } from '@/hooks/use-modules';
import { useAuth } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { SubscriptionCard } from '@/components/dashboard/subscription-card';
import { Handshake } from 'lucide-react';

export function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { modules, dbConfigured } = useModules();
  
    return (
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-24 items-center justify-center border-b px-4 lg:h-32">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Logo />
            </Link>
          </div>
           {/* Add padding bottom to make sure the last nav item is visible above the fixed card */}
          <div className="flex-1 overflow-y-auto pb-36">
            <nav className="grid items-start px-2 py-4 text-sm font-medium lg:px-4">
              {!dbConfigured && (
                <p className="p-4 text-xs text-destructive">
                    Erro: DB não configurado.
                </p>
              )}
              {modules.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/dashboard/module/${mod.id}`}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                    pathname === `/dashboard/module/${mod.id}` && 'bg-muted text-primary'
                  )}
                >
                  <mod.icon className="h-4 w-4" />
                  {mod.title}
                </Link>
              ))}

              {user?.role === 'affiliate' && (
                 <Link
                    href="/dashboard/affiliate"
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                      pathname === '/dashboard/affiliate' && 'bg-muted text-primary'
                    )}
                  >
                    <Handshake className="h-4 w-4" />
                    Painel de Afiliado
                  </Link>
              )}
            </nav>
          </div>
        </div>

        {/* Fixed subscription card at the bottom of the viewport */}
        <div className="fixed bottom-5 z-50 p-4 md:w-[220px] lg:w-[280px]">
          <SubscriptionCard />
        </div>
      </div>
    );
  }
