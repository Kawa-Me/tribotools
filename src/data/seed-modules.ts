// This file contains the initial module data to be seeded into Firestore.

import type { Module, Lesson } from '@/lib/types';

// The data structure for Firestore, where 'icon' is a string name of a lucide-react icon.
export const seedModules: (Omit<Module, 'id' | 'icon' | 'lessons'> & { icon: string; lessons: Omit<Lesson, 'id'>[] })[] = [
  {
    title: 'Design e Edição',
    description: 'Ferramentas de design para criar materiais incríveis.',
    icon: 'Paintbrush',
    permission: 'ferramentas',
    lessons: [
      { title: 'Canva PRO', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//canva.png', accessUrl: 'https://www.canva.com', buttonText: 'Acessar Canva', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'CapCut Pro', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//cap%20cut.png', accessUrl: 'https://www.capcut.com', buttonText: 'Acessar CapCut', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'Leonardo A.I', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//leonardoia.png', accessUrl: 'https://leonardo.ai', buttonText: 'Acessar Leonardo A.I', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'Midjourney', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://placehold.co/400x533.png', accessUrl: 'https://www.midjourney.com', buttonText: 'Acessar Midjourney', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
    ],
  },
  {
    title: 'Inteligências Artificiais',
    description: 'Acesso a IAs poderosas para otimizar seu trabalho.',
    icon: 'BrainCircuit',
    permission: 'ferramentas',
    lessons: [
      { title: 'ChatGPT 4.0', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//gpt.png', accessUrl: 'https://chat.openai.com', buttonText: 'Acessar ChatGPT', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'Grok A.I.', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://placehold.co/400x533.png', accessUrl: 'https://grok.x.ai', buttonText: 'Acessar Grok', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'HeyGen', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://placehold.co/400x533.png', accessUrl: 'https://www.heygen.com', buttonText: 'Acessar HeyGen', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'Gamma App', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://placehold.co/400x533.png', accessUrl: 'https://gamma.app', buttonText: 'Acessar Gamma', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'Voice Clone', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//voiceCLone.png', accessUrl: '#', buttonText: 'Acessar Voice Clone', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'Perplexity', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://placehold.co/400x533.png', accessUrl: 'https://www.perplexity.ai', buttonText: 'Acessar Perplexity', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'Clicopy', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://placehold.co/400x533.png', accessUrl: '#', buttonText: 'Acessar Clicopy', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
    ],
  },
  {
    title: 'Instruções de Acesso',
    description: 'Como acessar e baixar a extensão exclusiva.',
    icon: 'KeyRound',
    permission: 'public',
    lessons: [
      { title: 'Vídeo de Instruções', type: 'video', content: 'https://www.youtube.com/embed/dQw4w9WgXcQ', status: 'active' },
      { title: 'Download da Extensão', type: 'text', content: '## Link para Download\n\nClique no link abaixo para baixar a extensão. Lembre-se de seguir as instruções do vídeo para a instalação correta.', accessUrl: 'https://example.com/download', buttonText: 'Baixar Extensão', status: 'active' },
    ],
  },
  {
    title: 'Ferramentas de SEO',
    description: 'Otimize seu posicionamento nos buscadores.',
    icon: 'TrendingUp',
    permission: 'ferramentas',
    lessons: [
      { title: 'SemRush', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//semrush.png', accessUrl: 'https://semrush.com', buttonText: 'Acessar SemRush', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'Similar Web', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//sinilarweb.png', accessUrl: 'https://similarweb.com', buttonText: 'Acessar Similar Web', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'Ubersuggest', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//ubersuggest.png', accessUrl: 'https://neilpatel.com/ubersuggest', buttonText: 'Acessar Ubersuggest', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
    ],
  },
  {
    title: 'Plataformas de Espionagem',
    description: 'Ferramentas para análise de concorrência e mineração de dados.',
    icon: 'SearchCode',
    permission: 'ferramentas',
    lessons: [
      { title: 'DropKiller', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://placehold.co/400x533.png', accessUrl: '#', buttonText: 'Acessar DropKiller', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'Adsparo', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//adsparo.png', accessUrl: 'https://adsparo.com', buttonText: 'Acessar Adsparo', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
      { title: 'SpyGuru', type: 'text', content: 'Acesso via extensão.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//spyguru.png', accessUrl: '#', buttonText: 'Acessar SpyGuru', accessEmail: 'user@example.com', accessPassword: 'password123', status: 'active' },
    ],
  },
  {
    title: 'ZapVoice',
    description: 'Envie áudios com vozes de famosos no WhatsApp.',
    icon: 'MessageSquare',
    permission: 'zapvoice',
    lessons: [
      { title: 'Acessar ZapVoice', type: 'text', content: 'Acesso à ferramenta ZapVoice.', imageUrl: 'https://pjuifgyrftpnjpurmzzn.supabase.co/storage/v1/object/public/tribo//zapvoice.png', accessUrl: '#', buttonText: 'Acessar ZapVoice', status: 'active' },
    ]
  },
];
