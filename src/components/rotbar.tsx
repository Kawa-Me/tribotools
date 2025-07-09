'use client';

import { FaWhatsapp } from 'react-icons/fa';

export function Rotbar() {
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-3 z-50">
      {/* Botão Suporte */}
      <a
        href="https://wa.me/5545984325338"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 bg-card text-card-foreground rounded-xl shadow-lg hover:bg-muted transition border border-primary"
      >
        <FaWhatsapp size={18} className="text-primary" />
        Suporte
      </a>

      {/* Botão Grupo */}
      <a
        href="https://chat.whatsapp.com/LK6HtNWM4NODbH1gZKgypo"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 bg-card text-card-foreground rounded-xl shadow-lg hover:bg-muted transition border border-input"
      >
        <FaWhatsapp size={18} />
        Grupo
      </a>
    </div>
  );
}
