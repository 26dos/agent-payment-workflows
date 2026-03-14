'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Bot,
  ListTodo,
  Wallet,
  Award,
  LogOut,
  Link2,
  Gift,
  FileText,
  User,
  Crown,
  Menu,
  X,
  Fingerprint,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  { href: '/dashboard/did', labelKey: 'sidebar.myDid', icon: User },
  { href: '/dashboard/did/market', labelKey: 'sidebar.premiumDids', icon: Crown },
  { href: '/dashboard/agents', labelKey: 'sidebar.agents', icon: Bot },
  { href: '/dashboard/tasks', labelKey: 'sidebar.tasks', icon: ListTodo },
  { href: '/dashboard/tasks/publish', labelKey: 'sidebar.publishTask', icon: FileText },
  { href: '/dashboard/incentives', labelKey: 'sidebar.incentives', icon: Gift },
  { href: '/dashboard/wallet', labelKey: 'sidebar.wallet', icon: Wallet },
  { href: '/dashboard/reputation', labelKey: 'sidebar.reputation', icon: Award },
  { href: '/dashboard/admin/batch', labelKey: 'sidebar.batchOnChain', icon: Link2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { clearAuth } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-50 rounded-xl bg-card/90 backdrop-blur-sm p-2.5 border border-border/50 lg:hidden hover:border-primary/50 transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-5 w-5 text-primary" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center border-b border-border/50 px-6">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-md group-hover:blur-lg transition-all" />
                <div className="relative bg-gradient-to-br from-primary to-accent p-2 rounded-xl">
                  <Fingerprint className="h-5 w-5 text-background" />
                </div>
              </div>
              <span className="text-xl font-bold gradient-text">ClawID</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,212,255,0.15)]'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0 transition-colors",
                    isActive && "text-primary"
                  )} />
                  <span className="truncate">{t(item.labelKey)}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-border/50 p-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
              onClick={clearAuth}
            >
              <LogOut className="h-5 w-5" />
              {t('common.disconnect')}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
