// This file contains the initial module data to be seeded into Firestore.

import type { Module, Lesson } from '@/lib/types';

// The data structure for Firestore, where 'icon' is a string name of a lucide-react icon.
export const seedModules: (Omit<Module, 'id' | 'icon' | 'lessons'> & { icon: string; lessons: Omit<Lesson, 'id'>[] })[] = [
  {
    title: 'Instruções de Acesso',
    description: 'Como acessar e baixar a extensão exclusiva.',
    icon: 'KeyRound',
    lessons: [
      { title: 'Vídeo de Instruções', type: 'video', content: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
      { title: 'Download da Extensão', type: 'text', content: '## Link para Download\n\nClique no link abaixo para baixar a extensão. Lembre-se de seguir as instruções do vídeo para a instalação correta.\n\n[Baixar Extensão](https://example.com/download)' },
    ],
  },
  {
    title: 'Plataformas de Espionagem',
    description: 'Ferramentas para análise de concorrência e mineração de dados.',
    icon: 'SearchCode',
    lessons: [
      { title: 'Dropkiller', type: 'text', content: 'Acesso à ferramenta Dropkiller.' },
      { title: 'Adsparo', type: 'text', content: 'Acesso à ferramenta Adsparo.' },
      { title: 'SpyGuru', type: 'text', content: 'Acesso à ferramenta SpyGuru.' },
    ],
  },
  {
    title: 'Inteligências Artificiais',
    description: 'Acesso a IAs poderosas para otimizar seu trabalho.',
    icon: 'BrainCircuit',
    lessons: [
      { title: 'ChatGPT 4.0', type: 'text', content: 'Acesso ao ChatGPT 4.0.' },
      { title: 'Grok A.I', type: 'text', content: 'Acesso ao Grok A.I.' },
      { title: 'Perplexity', type: 'text', content: 'Acesso ao Perplexity.' },
      { title: 'Gamma App', type: 'text', content: 'Acesso ao Gamma App.' },
      { title: 'Heygen', type: 'text', content: 'Acesso ao Heygen.' },
      { title: 'Voice Clone', type: 'text', content: 'Acesso à ferramenta de clonagem de voz.' },
      { title: 'Clicopy', type: 'text', content: 'Acesso ao Clicopy.' },
    ],
  },
  {
    title: 'Design e Edição',
    description: 'Ferramentas de design para criar materiais incríveis.',
    icon: 'Paintbrush',
    lessons: [
      { title: 'Canva PRO', type: 'text', content: 'Acesso ao Canva PRO.' },
      { title: 'CapCut Pro', type: 'text', content: 'Acesso ao CapCut Pro.' },
      { title: 'Leonardo A.I', type: 'text', content: 'Acesso ao Leonardo A.I.' },
      { title: 'Midjourney', type: 'text', content: 'Acesso ao Midjourney.' },
    ],
  },
  {
    title: 'Ferramentas de SEO',
    description: 'Otimize seu posicionamento nos buscadores.',
    icon: 'TrendingUp',
    lessons: [
      { title: 'SemRush', type: 'text', content: 'Acesso ao SemRush.' },
      { title: 'Similar Web', type: 'text', content: 'Acesso ao Similar Web.' },
      { title: 'Ubersuggest', type: 'text', content: 'Acesso ao Ubersuggest.' },
    ],
  },
];
