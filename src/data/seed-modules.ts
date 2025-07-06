// This file contains the initial module data to be seeded into Firestore.

import type { Module, Lesson } from '@/lib/types';

// The data structure for Firestore, where 'icon' is a string name of a lucide-react icon.
export const seedModules: (Omit<Module, 'id' | 'icon' | 'lessons'> & { icon: string; lessons: Omit<Lesson, 'id'>[] })[] = [
  {
    title: 'Design e Edição',
    description: 'Ferramentas de design para criar materiais incríveis.',
    icon: 'Paintbrush',
    lessons: [
      { title: 'Canva PRO', type: 'text', content: 'Acesso ao Canva PRO.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//canva.png' },
      { title: 'CapCut Pro', type: 'text', content: 'Acesso ao CapCut Pro.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//cap%20cut.png' },
      { title: 'Leonardo A.I', type: 'text', content: 'Acesso ao Leonardo A.I.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//leonardoia.png' },
      { title: 'Midjourney', type: 'text', content: 'Acesso ao Midjourney.', imageUrl: 'https://placehold.co/400x240.png' },
    ],
  },
  {
    title: 'Inteligências Artificiais',
    description: 'Acesso a IAs poderosas para otimizar seu trabalho.',
    icon: 'BrainCircuit',
    lessons: [
      { title: 'ChatGPT 4.0', type: 'text', content: 'Acesso ao ChatGPT 4.0.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//gpt.png' },
      { title: 'Grok A.I.', type: 'text', content: 'Acesso ao Grok A.I.', imageUrl: 'https://placehold.co/400x240.png' },
      { title: 'HeyGen', type: 'text', content: 'Acesso ao Heygen.', imageUrl: 'https://placehold.co/400x240.png' },
      { title: 'Gamma App', type: 'text', content: 'Acesso ao Gamma App.', imageUrl: 'https://placehold.co/400x240.png' },
      { title: 'Voice Clone', type: 'text', content: 'Acesso à ferramenta de clonagem de voz.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//voiceCLone.png' },
      { title: 'Perplexity', type: 'text', content: 'Acesso ao Perplexity.', imageUrl: 'https://placehold.co/400x240.png' },
      { title: 'Clicopy', type: 'text', content: 'Acesso ao Clicopy.', imageUrl: 'https://placehold.co/400x240.png' },
    ],
  },
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
    title: 'Ferramentas de SEO',
    description: 'Otimize seu posicionamento nos buscadores.',
    icon: 'TrendingUp',
    lessons: [
      { title: 'SemRush', type: 'text', content: 'Acesso ao SemRush.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//semrush.png' },
      { title: 'Similar Web', type: 'text', content: 'Acesso ao Similar Web.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//sinilarweb.png' },
      { title: 'Ubersuggest', type: 'text', content: 'Acesso ao Ubersuggest.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//ubersuggest.png' },
    ],
  },
  {
    title: 'Plataformas de Espionagem',
    description: 'Ferramentas para análise de concorrência e mineração de dados.',
    icon: 'SearchCode',
    lessons: [
      { title: 'DropKiller', type: 'text', content: 'Acesso à ferramenta Dropkiller.', imageUrl: 'https://placehold.co/400x240.png' },
      { title: 'Adsparo', type: 'text', content: 'Acesso à ferramenta Adsparo.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//adsparo.png' },
      { title: 'SpyGuru', type: 'text', content: 'Acesso à ferramenta SpyGuru.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//spyguru.png' },
    ],
  },
];
