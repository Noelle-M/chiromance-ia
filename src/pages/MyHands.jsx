import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BookMarked, Hand, Loader2, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ConfirmDialog, ErrorDialog } from "@/components/Dialogs";

const TYPE_LABELS = { full: "Lecture complète", quick: "Lecture rapide", compatibility: "Compatibilité" };

export default function MyHands() {
  const [scans, setScans] = useState([]);
  const [compatibilities, setCompatibilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const page = await base44.entities.Scan.filter({}, { sort: '-created_date', limit: 50, fields: ['id', 'scan_type', 'status', 'right_hand_photo', 'created_date'] });
      setScans(page.items || []);
      try {
        const response = await base44.functions.invoke('listMyCompatibilities', {});
        setCompatibilities((response.data?.entries || []).filter((entry) => entry.status !== 'cancelled'));
      } catch (error) { setCompatibilities([]); }
    } catch (e) { setScans([]); }
    setLoading(false);
  };

  const askDelete = (e, scanId) => {
    e.preventDefault();
    e.stopPropagation();
    setToDelete({ kind: 'scan', id: scanId });
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { id: scanId, kind } = toDelete;
    setDeleting(true);
    try {
      if (kind === 'pair') {
        const response = await base44.functions.invoke('hideMyCompatibility', { compatibilityId: scanId });
        if (!response.data?.ok) throw new Error('hide_failed');
        setCompatibilities((prev) => prev.filter((c) => c.id !== scanId));
        setToDelete(null);
        return;
      }
      const obsPage = await base44.entities.Observation.filter({ scan_id: scanId }, { limit: 100, fields: ['id'] });
      if (obsPage.items?.length) await base44.entities.Observation.deleteMany({ scan_id: scanId });
      const readPage = await base44.entities.Reading.filter({ scan_id: scanId }, { limit: 50, fields: ['id'] });
      for (const r of readPage.items || []) {
        const repPage = await base44.entities.Report.filter({ reading_id: r.id }, { limit: 10, fields: ['id'] });
        if (repPage.items?.length) await base44.entities.Report.deleteMany({ reading_id: r.id });
        await base44.entities.Reading.delete(r.id);
      }
      await base44.entities.Scan.delete(scanId);
      setScans((prev) => prev.filter((s) => s.id !== scanId));
      setToDelete(null);
    } catch (err) {
      setToDelete(null);
      setError("Suppression impossible pour le moment.");
    }
    setDeleting(false);
  };

  useEffect(() => { load(); }, []);

  const history = [
    ...compatibilities.map((c) => ({ kind: 'pair', id: c.id, date: c.created_date, data: c })),
    ...scans.filter((s) => s.scan_type !== 'compatibility').map((s) => ({ kind: 'scan', id: s.id, date: s.created_date, data: s })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

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
      ) : history.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Hand size={28} className="mx-auto text-primary/50 mb-3" />
          <p className="text-sm text-muted-foreground">Aucune analyse pour l'instant.</p>
          <p className="text-xs text-muted-foreground mt-1">Commencez par scanner vos mains.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => item.kind === 'pair' ? (
            <Link key={`pair-${item.id}`} to={`/compatibilite?id=${encodeURIComponent(item.id)}`} className="glass-card flex items-center gap-3 p-3 hover:border-primary/40 transition-colors group">
              <div className="flex shrink-0 -space-x-3">
                {[item.data.photo_a_url, item.data.photo_b_url].map((url, index) => (
                  <div key={index} className="w-11 h-14 rounded-lg overflow-hidden bg-black/40 border border-border flex items-center justify-center">
                    {url ? <img src={url} alt={index === 0 ? 'Main de la personne invitante' : 'Main de la personne invitée'} className="w-full h-full object-cover" /> : <Hand size={18} className="text-muted-foreground" />}
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base">Compatibilité</p>
                <p className="text-[11px] text-muted-foreground">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <span className="text-[10px] text-primary">{item.data.status === 'completed' ? 'Analyse commune disponible' : item.data.status === 'accepted' ? 'Analyse en cours' : 'En attente de la seconde main'}</span>
              </div>
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setToDelete({ kind: 'pair', id: item.id }); }} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Retirer cette compatibilité de mon historique"><Trash2 size={16} /></button>
            </Link>
          ) : (
            <Link key={item.id} to={item.data.scan_type === 'compatibility' ? `/compatibilite?scan=${encodeURIComponent(item.id)}` : `/lecture/${item.id}`} className="glass-card flex items-center gap-3 p-3 hover:border-primary/40 transition-colors group">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                {item.data.right_hand_photo ? <PalmThumb uri={item.data.right_hand_photo} /> : <Hand size={18} className="text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base truncate">{TYPE_LABELS[item.data.scan_type] || 'Lecture'}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                {item.data.scan_type === 'compatibility' ? <span className="text-[10px] text-primary">Compatibilité non associée</span> : <StatusBadge status={item.data.status} />}
              </div>
              <button onClick={(e) => askDelete(e, item.id)} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Supprimer cette analyse"><Trash2 size={16} /></button>
            </Link>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!deleting) setToDelete(o ? toDelete : null); }}
        title={toDelete?.kind === "pair" ? "Retirer cette compatibilité ?" : "Supprimer cette analyse ?"}
        description={toDelete?.kind === "pair" ? "Cette compatibilité disparaîtra uniquement de votre historique. L’autre personne conservera ses photos et son analyse." : "Cette analyse et ses lectures, observations et rapports liés seront supprimés définitivement. Cette action est irréversible."}
        confirmLabel={toDelete?.kind === "pair" ? "Retirer de mon historique" : "Supprimer"}
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
      <ErrorDialog
        open={!!error}
        onOpenChange={setError}
        description={error}
      />
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