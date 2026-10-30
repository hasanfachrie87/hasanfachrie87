import React, { useState } from 'react';
import { BookOpen, BookMarked, Palette, Cpu, Atom, Globe } from 'lucide-react';

interface BookCoverProps {
  title: string;
  author: string;
  category: string;
  coverUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BookCover: React.FC<BookCoverProps> = ({
  title,
  author,
  category,
  coverUrl,
  size = 'md',
}) => {
  const [imageError, setImageError] = useState(false);

  const getCategoryTheme = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('sains') || lower.includes('matematika') || lower.includes('fisika')) {
      return {
        bg: 'bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950',
        accent: 'border-blue-500/30',
        Icon: Atom,
      };
    }
    if (lower.includes('teknologi') || lower.includes('komputer') || lower.includes('informatika')) {
      return {
        bg: 'bg-gradient-to-br from-slate-900 via-zinc-900 to-cyan-950',
        accent: 'border-cyan-500/30',
        Icon: Cpu,
      };
    }
    if (lower.includes('sastra') || lower.includes('fiksi') || lower.includes('novel')) {
      return {
        bg: 'bg-gradient-to-br from-amber-900 via-stone-900 to-orange-950',
        accent: 'border-amber-500/30',
        Icon: Palette,
      };
    }
    if (lower.includes('sejarah') || lower.includes('sosial')) {
      return {
        bg: 'bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900',
        accent: 'border-emerald-500/30',
        Icon: Globe,
      };
    }
    return {
      bg: 'bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-950',
      accent: 'border-slate-500/30',
      Icon: BookMarked,
    };
  };

  const theme = getCategoryTheme(category);
  const IconComponent = theme.Icon;

  const dimensions = {
    sm: 'w-11 h-16 rounded',
    md: 'w-20 h-28 rounded-md',
    lg: 'w-full aspect-[3/4] rounded-lg',
  }[size];

  if (coverUrl && coverUrl.trim() !== '' && !imageError) {
    return (
      <div className={`${dimensions} overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative`}>
        <img
          src={coverUrl}
          alt={`Cover buku ${title}`}
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dimensions} ${theme.bg} text-white p-2.5 flex flex-col justify-between border ${theme.accent} shrink-0 select-none relative overflow-hidden`}
    >
      <div className="flex items-center justify-between opacity-75">
        <IconComponent className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        {size !== 'sm' && (
          <span className="text-[9px] font-mono tracking-tight truncate max-w-[80%]">
            {category.split(' ')[0]}
          </span>
        )}
      </div>

      <div className="my-auto py-1">
        <p
          className={`font-display font-semibold leading-tight line-clamp-3 ${
            size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-[11px]' : 'text-sm'
          }`}
        >
          {title}
        </p>
      </div>

      {size !== 'sm' && (
        <div className="pt-1 border-t border-white/15">
          <p className="text-[9px] text-white/75 truncate">{author}</p>
        </div>
      )}
    </div>
  );
};
