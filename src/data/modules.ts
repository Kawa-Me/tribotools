import { BookOpen, LayoutDashboard, Settings, ShieldCheck, Users } from 'lucide-react';
import type { Module } from '@/lib/types';

export const modules: Module[] = [
  {
    id: '1',
    title: 'Módulo 1: Introdução',
    description: 'Comece sua jornada e aprenda os conceitos fundamentais.',
    icon: LayoutDashboard,
    lessons: [
      { id: '1-1', title: 'Aula 1: Bem-vindo ao Membro Forte', type: 'video', content: 'https://placehold.co/1920x1080.png' },
      { id: '1-2', title: 'Aula 2: Navegando na plataforma', type: 'text', content: '## Explore cada seção\n\nFamiliarize-se com o layout para aproveitar ao máximo.' },
    ],
  },
  {
    id: '2',
    title: 'Módulo 2: Conteúdo Principal',
    description: 'Aprofunde-se nos tópicos centrais do nosso programa.',
    icon: BookOpen,
    lessons: [
      { id: '2-1', title: 'Aula 1: Tópico Avançado A', type: 'video', content: 'https://placehold.co/1920x1080.png' },
      { id: '2-2', title: 'Aula 2: Tópico Avançado B', type: 'video', content: 'https://placehold.co/1920x1080.png' },
    ],
  },
  {
    id: '3',
    title: 'Módulo 3: Comunidade',
    description: 'Interaja com outros membros e construa sua rede.',
    icon: Users,
    lessons: [
      { id: '3-1', title: 'Aula 1: A importância do networking', type: 'text', content: '### Conecte-se e cresça\n\nNossa comunidade é um dos nossos maiores ativos.' },
    ],
  },
  {
    id: '4',
    title: 'Módulo 4: Ferramentas e Recursos',
    description: 'Acesse ferramentas exclusivas para acelerar seu progresso.',
    icon: Settings,
    lessons: [
      { id: '4-1', title: 'Aula 1: Guia de Ferramentas', type: 'video', content: 'https://placehold.co/1920x1080.png' },
    ],
  },
  {
    id: '5',
    title: 'Módulo 5: Bônus',
    description: 'Conteúdo extra e materiais complementares para você.',
    icon: ShieldCheck,
    lessons: [
      { id: '5-1', title: 'Aula 1: Masterclass Especial', type: 'video', content: 'https://placehold.co/1920x1080.png' },
    ],
  },
];
