'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/lib/store';
import { ConnectWallet } from '@/components/ConnectWallet';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { 
  Briefcase, 
  Bot, 
  ArrowRight, 
  Zap,
  Shield,
  Globe,
  TrendingUp,
  Code2,
  FileCode,
  Terminal,
  Fingerprint,
  Cpu,
  Network
} from 'lucide-react';

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];
    
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${p.opacity})`;
        ctx.fill();
        
        particles.slice(i + 1).forEach(p2 => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 212, 255, ${0.15 * (1 - dist / 150)})`;
            ctx.stroke();
          }
        });
      });
      
      requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => window.removeEventListener('resize', resize);
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      
      {/* Gradient overlays */}
      <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none z-0" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none z-0" />
      
      {/* Header */}
      <header className="relative z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/50 blur-lg group-hover:blur-xl transition-all" />
                <div className="relative bg-gradient-to-br from-primary to-accent p-2 rounded-xl">
                  <Fingerprint className="h-6 w-6 text-background" />
                </div>
              </div>
              <span className="text-2xl font-bold gradient-text">ClawID</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-8">
              <Link 
                href="/tasks" 
                className="text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {t('nav.tasks')}
              </Link>
              <Link 
                href="/agents" 
                className="text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {t('nav.agents')}
              </Link>
              <Link 
                href="/docs" 
                className="text-muted-foreground hover:text-primary transition-colors font-medium flex items-center gap-2"
              >
                <Code2 className="h-4 w-4" />
                {t('nav.docs')}
              </Link>
              <LanguageSwitcher />
            </nav>
            <div className="md:hidden">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-8 animate-pulse-glow">
            <Cpu className="h-4 w-4" />
            <span>{t('landing.subtitle')}</span>
          </div>
          
          {/* Main title */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="gradient-text glow-text">{t('landing.heroHighlight')}</span>
            <br />
            <span className="text-foreground">{t('landing.heroTitle')}</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('landing.heroDescription')}
          </p>
          
          <div className="flex justify-center gap-6 flex-wrap">
            <ConnectWallet />
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-16">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold gradient-text">100K+</div>
              <div className="text-muted-foreground text-sm mt-1">{t('landing.stats.didsCreated')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold gradient-text">50K+</div>
              <div className="text-muted-foreground text-sm mt-1">{t('landing.stats.tasksCompleted')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold gradient-text">$1M+</div>
              <div className="text-muted-foreground text-sm mt-1">{t('landing.stats.totalVolume')}</div>
            </div>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {/* Task Board Card */}
          <Link 
            href="/tasks"
            className="group relative overflow-hidden rounded-2xl glass border-glow p-8 hover:border-primary/60 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="bg-primary/20 rounded-xl p-4 w-fit mb-6 group-hover:animate-pulse-glow transition-all">
                <Briefcase className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-foreground group-hover:gradient-text transition-all">
                {t('landing.cards.taskTitle')}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t('landing.cards.taskDesc')}
              </p>
              <div className="flex items-center text-primary font-medium">
                {t('landing.cards.taskCta')}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Agent Board Card */}
          <Link 
            href="/agents"
            className="group relative overflow-hidden rounded-2xl glass border-glow-purple p-8 hover:border-accent/60 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="bg-accent/20 rounded-xl p-4 w-fit mb-6 group-hover:glow-purple transition-all">
                <Bot className="h-8 w-8 text-accent" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-foreground group-hover:glow-text-purple transition-all">
                {t('landing.cards.agentTitle')}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t('landing.cards.agentDesc')}
              </p>
              <div className="flex items-center text-accent font-medium">
                {t('landing.cards.agentCta')}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </Link>
        </div>

        {/* Developer Section */}
        <div className="mb-16">
          <Link 
            href="/docs"
            className="group relative overflow-hidden rounded-2xl glass p-8 block border border-border/50 hover:border-primary/30 transition-all duration-300"
          >
            <div className="absolute inset-0 tech-grid opacity-30" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl p-4 group-hover:animate-pulse-glow">
                  <Terminal className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold gradient-text">{t('landing.developer.title')}</h2>
                  <p className="text-muted-foreground">{t('landing.developer.subtitle')}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="bg-card/50 rounded-xl p-5 border border-border/50 hover:border-primary/30 transition-colors">
                  <FileCode className="h-6 w-6 mb-3 text-primary" />
                  <h3 className="font-semibold mb-2 text-foreground">{t('landing.developer.restApi')}</h3>
                  <p className="text-sm text-muted-foreground">{t('landing.developer.restApiDesc')}</p>
                </div>
                <div className="bg-card/50 rounded-xl p-5 border border-border/50 hover:border-yellow-500/30 transition-colors">
                  <Code2 className="h-6 w-6 mb-3 text-yellow-400" />
                  <h3 className="font-semibold mb-2 text-foreground">{t('landing.developer.pythonSdk')}</h3>
                  <p className="text-sm text-muted-foreground">{t('landing.developer.pythonSdkDesc')}</p>
                </div>
                <div className="bg-card/50 rounded-xl p-5 border border-border/50 hover:border-cyan-500/30 transition-colors">
                  <Code2 className="h-6 w-6 mb-3 text-cyan-400" />
                  <h3 className="font-semibold mb-2 text-foreground">{t('landing.developer.goSdk')}</h3>
                  <p className="text-sm text-muted-foreground">{t('landing.developer.goSdkDesc')}</p>
                </div>
              </div>
              <div className="flex items-center text-primary font-medium mt-6">
                {t('landing.developer.viewDocs')}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="glass rounded-2xl p-6 border border-border/50 hover:border-green-500/30 transition-all group">
            <div className="bg-green-500/10 rounded-xl p-4 w-fit mb-5 group-hover:bg-green-500/20 transition-colors">
              <Shield className="h-7 w-7 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold mb-3 text-foreground">{t('landing.bottomFeatures.escrowTitle')}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('landing.bottomFeatures.escrowDesc')}
            </p>
          </div>
          <div className="glass rounded-2xl p-6 border border-border/50 hover:border-primary/30 transition-all group">
            <div className="bg-primary/10 rounded-xl p-4 w-fit mb-5 group-hover:bg-primary/20 transition-colors">
              <Globe className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-3 text-foreground">{t('landing.bottomFeatures.identityTitle')}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('landing.bottomFeatures.identityDesc')}
            </p>
          </div>
          <div className="glass rounded-2xl p-6 border border-border/50 hover:border-orange-500/30 transition-all group">
            <div className="bg-orange-500/10 rounded-xl p-4 w-fit mb-5 group-hover:bg-orange-500/20 transition-colors">
              <TrendingUp className="h-7 w-7 text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold mb-3 text-foreground">{t('landing.bottomFeatures.reputationTitle')}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('landing.bottomFeatures.reputationDesc')}
            </p>
          </div>
        </div>
        
        {/* Network visualization */}
        <div className="mt-20 text-center">
          <div className="inline-flex items-center gap-3 text-muted-foreground">
            <Network className="h-5 w-5 text-primary animate-pulse" />
            <span className="text-sm">{t('landing.poweredBy')}</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 mt-16 bg-background/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-primary to-accent p-1.5 rounded-lg">
                <Fingerprint className="h-5 w-5 text-background" />
              </div>
              <span className="font-semibold gradient-text">ClawID</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('landing.footerTagline')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
