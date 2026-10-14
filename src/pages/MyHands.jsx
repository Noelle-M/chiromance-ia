import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BookMarked, Hand, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TYPE_LABELS = { full: "Lecture complète", quick: "Lecture rapide", compatibility: "Compatibilité" };

export default function MyHands() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const page = await base44.entities.Scan.filter({}, { sort: '-created_date', limit: 50, fields: ['id', 'scan_type', 'status', 'right_hand_photo', 'created_date'] });
      setScans(page.items || []);
    } catch (e) { setScans([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="px-6 pt-12 pb-6 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Mes mains</h1>
        <p className="text-sm text-muted-foreground mt-1">Vos analyses et votre grimoire personnel.</p>
      </header>

      <Link to="/scanner" className="btn-gold w-full flex items-center justify-center gap-2 py-3 mb-4">
        <Plus size={18} /> Nouvelle lecture
      </Link>

      <Link to="/grimoire" className="glass-card flex items-center gap-4 p-4 mb-6 hover:border-primary/40 transition-colors">
        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <BookMarked size={20} />
        </div>
        <div className="flex-1 text-left">
          <p className="font-display text-lg">Mon grimoire</p>
          <p className="text-xs text-muted-foreground">Vos mains annotées et leurs interprétations</p>
        </div>
      </Link>

      <h2 className="font-display text-xl mb-3 text-primary/90">Historique</h2>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
      ) : scans.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Hand size={28} className="mx-auto text-primary/50 mb-3" />
          <p className="text-sm text-muted-foreground">Aucune analyse pour l'instant.</p>
          <p className="text-xs text-muted-foreground mt-1">Commencez par scanner vos mains.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((s) => (
            <Link key={s.id} to={`/lecture/${s.id}`} className="glass-card flex items-center gap-3 p-3 hover:border-primary/40 transition-colors">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                {s.right_hand_photo ? <PalmThumb uri={s.right_hand_photo} /> : <Hand size={18} className="text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base truncate">{TYPE_LABELS[s.scan_type] || 'Lecture'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(s.created_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <StatusBadge status={s.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { t: 'En attente', c: 'text-muted-foreground' },
    analyzing: { t: 'Analyse en cours', c: 'text-primary' },
    analyzed: { t: 'Lecture disponible', c: 'text-primary' },
    failed: { t: 'Échec', c: 'text-destructive' },
  };
  const m = map[status] || map.pending;
  return <span className={`text-[10px] ${m.c}`}>{m.t}</span>;
}

function PalmThumb({ uri }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
        setUrl(signed_url);
      } catch (e) { /* ignore */ }
    })();
  }, [uri]);
  return url ? <img src={url} alt="main" className="w-full h-full object-cover" /> : <Hand size={18} className="text-muted-foreground" />;
}