'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const locales = ['en', 'zh'] as const;
type Locale = (typeof locales)[number];

export function LanguageSwitcher() {
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1] as Locale;
    if (savedLocale && locales.includes(savedLocale)) {
      setCurrentLocale(savedLocale);
    }
  }, []);

  const toggleLocale = () => {
    const next: Locale = currentLocale === 'en' ? 'zh' : 'en';
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setCurrentLocale(next);
    router.refresh();
  };

  if (!mounted) {
    return (
      <button className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground">
        En / 中文
      </button>
    );
  }

  return (
    <button
      onClick={toggleLocale}
      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center gap-1.5"
    >
      <span className={currentLocale === 'en' ? 'text-primary font-bold' : 'text-muted-foreground'}>En</span>
      <span className="text-border">/</span>
      <span className={currentLocale === 'zh' ? 'text-primary font-bold' : 'text-muted-foreground'}>中文</span>
    </button>
  );
}
