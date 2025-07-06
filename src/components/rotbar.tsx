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
        className="flex items-center gap-2 px-4 py-2 bg-black text-foreground rounded-xl shadow-lg hover:bg-neutral-800 transition border border-primary"
      >
        <FaWhatsapp size={18} className="text-primary" />
        Suporte
      </a>

      {/* Botão Grupo */}
      <a
        href="https://chat.whatsapp.com/LK6HtNWM4NODbH1gZKgypo"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 bg-black text-secondary-foreground rounded-xl shadow-lg hover:bg-neutral-800 transition border border-input"
      >
        <FaWhatsapp size={18} />
        Grupo
      </a>
    </div>
  );
}
