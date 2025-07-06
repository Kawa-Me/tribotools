'use client';

import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { auth } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function UserNav() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Serviço de autenticação indisponível.',
      });
      return;
    }
    try {
      await signOut(auth);
      router.push('/login');
      toast({
        title: 'Até logo!',
        description: 'Você foi desconectado com segurança.',
      });
    } catch (error) {
      console.error('Sign out error', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível sair. Tente novamente.',
      });
    }
  };

  if (!user) return null;

  if (user.isAnonymous) {
    return (
      <Button asChild>
        <Link href="/signup">Criar Conta</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.photoURL ?? ''} alt="User avatar" data-ai-hint="user avatar" />
            <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.displayName || 'Usuário'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
