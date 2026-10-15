import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Hand, Heart, BookOpen, Sparkles, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image as UIImage } from "@/components/ui/image";

const HERO = "https://media.base44.com/images/public/6acf7ac9666c3d67f21e6933/cd4610f13_generated_image.png";

export default function Home() {
  const [lastScan, setLastScan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const page = await base44.entities.Scan.filter({ status: 'analyzed' }, { sort: '-created_date', limit: 1, fields: ['id', 'scan_type', 'created_date'] });
        if (page.items?.length) setLastScan(page.items[0]);
      } catch (e) { /* not logged in or no data */ }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <section className="relative flex flex-col items-center text-center px-6 pt-14 pb-10">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <UIImage src={HERO} fittingType="fit" className="w-full h-full opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
        </div>

        <div className="animate-fade-in-up">
          <p className="text-primary/80 text-xs tracking-[0.3em] uppercase mb-4">ChiromancIA</p>
          <h1 className="font-display text-4xl sm:text-5xl leading-tight text-foreground max-w-xs">
            Et si vos mains avaient une histoire à raconter ?
          </h1>
          <p className="mt-5 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Photographiez vos paumes, laissez ChiromancIA révéler vos lignes, et découvrez leurs significations au fil des traditions de chiromancie.
          </p>
        </div>
      </section>

      <section className="px-6 space-y-3 pb-6">
        <Link to="/scanner" className="glass-card flex items-center gap-4 p-4 group hover:border-primary/40 transition-colors">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Hand size={20} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-display text-lg text-foreground">Découvrir les secrets de mes mains</p>
            <p className="text-xs text-muted-foreground">Lecture complète ou rapide</p>
          </div>
          <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>

        <Link to="/compatibilite" className="glass-card flex items-center gap-4 p-4 group hover:border-primary/40 transition-colors">
          <div className="w-11 h-11 rounded-full bg-accent/20 flex items-center justify-center text-primary">
            <Heart size={20} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-display text-lg text-foreground">Explorer notre compatibilité</p>
            <p className="text-xs text-muted-foreground">Amour, amitié, travail et projets communs</p>
          </div>
          <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>

        <Link to="/apprendre" className="glass-card flex items-center gap-4 p-4 group hover:border-primary/40 transition-colors">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <BookOpen size={20} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-display text-lg text-foreground">Apprendre la chiromancie</p>
            <p className="text-xs text-muted-foreground">Cours progressif et gratuit</p>
          </div>
          <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      </section>

      {!loading && lastScan && (
        <section className="px-6 pb-10">
          <Link to={`/lecture/${lastScan.id}`} className="btn-ghost-gold w-full flex items-center justify-center gap-2 py-3 text-sm">
            <Sparkles size={16} /> Reprendre ma dernière lecture
          </Link>
        </section>
      )}

      <div className="px-6 pb-6">
        <div className="gold-divider" />
        <p className="text-center text-[11px] text-muted-foreground mt-4 leading-relaxed max-w-sm mx-auto">
          La chiromancie est une tradition symbolique et culturelle. Nos lectures n'engagent aucune prédiction scientifique de votre personnalité ou de votre avenir.
        </p>
      </div>
    </div>
  );
}