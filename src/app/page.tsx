import { redirect } from 'next/navigation';

export default function Home() {
  // O layout principal do painel em `/dashboard` agora cuida de toda a lógica de autenticação.
  // Esta página simplesmente redireciona para lá.
  redirect('/dashboard');

  // Esta parte do código é inalcançável, mas é necessária para que o componente seja válido.
  // O Next.js executa o redirecionamento antes de qualquer renderização.
  return null;
}
