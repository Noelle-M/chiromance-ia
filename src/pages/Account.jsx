import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Loader2, LogOut, Trash2, Download, Lock, Hand } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ConfirmDialog, ErrorDialog } from "@/components/Dialogs";

const TYPE_LABELS = { full: "Lecture complète", quick: "Lecture rapide", compatibility: "Compatibilité" };

export default function Account() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [name, setName] = useState("");
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scanToDelete, setScanToDelete] = useState(null);
  const [deletingScan, setDeletingScan] = useState(false);
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const u = await base44.auth.me();
      setMe(u);
      setName(u.full_name || "");
      const page = await base44.entities.Scan.filter({}, { sort: '-created_date', limit: 50, fields: ['id', 'scan_type', 'status', 'right_hand_photo', 'created_date'] });
      setScans(page.items || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveName = async () => {
    setSaving(true);
    try { await base44.auth.updateMe({ full_name: name }); setSaved(true); setTimeout(() => setSaved(false), 1500); } catch (e) {}
    setSaving(false);
  };

  const logout = async () => {
    await base44.auth.logout();
    window.location.href = '/login';
  };

  const confirmDeleteScan = async () => {
    const id = scanToDelete;
    setDeletingScan(true);
    try {
      await base44.entities.Observation.deleteMany({ scan_id: id });
      await base44.entities.Scan.delete(id);
      setScans(scans.filter((s) => s.id !== id));
      setScanToDelete(null);
    } catch (e) {
      setScanToDelete(null);
      setError("Suppression impossible.");
    }
    setDeletingScan(false);
  };

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const response = await base44.functions.invoke('deleteMyAccount', { confirm: 'SUPPRIMER' });
      if (response.data?.ok !== true) throw new Error('account_deletion_failed');
      await base44.auth.logout().catch(() => {});
      window.location.href = '/login';
    } catch (e) {
      setAccountDeleteOpen(false);
      setError("Suppression non confirmée. Certaines données peuvent déjà avoir été supprimées. Contactez le support avant de réessayer.");
    }
    setDeletingAccount(false);
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="px-6 pt-12 pb-8 max-w-md mx-auto">
      <header className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
          <User size={28} />
        </div>
        <h1 className="font-display text-2xl">{me?.full_name || me?.email || 'Mon compte'}</h1>
        <p className="text-xs text-muted-foreground">{me?.email}</p>
      </header>

      <section className="glass-card p-4 mb-5">
        <label className="text-xs text-muted-foreground">Prénom</label>
        <div className="flex gap-2 mt-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-input border border-border rounded-xl px-3 py-2 text-sm"
            placeholder="Votre prénom"
          />
          <button onClick={saveName} disabled={saving} className="btn-gold px-4 text-sm">
            {saved ? '✓' : 'OK'}
          </button>
        </div>
      </section>

      <h2 className="font-display text-xl mb-3 text-primary/90">Historique</h2>
      <div className="space-y-3 mb-6">
        {scans.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <Hand size={24} className="mx-auto text-primary/50 mb-2" />
            <p className="text-sm text-muted-foreground">Aucun scan.</p>
          </div>
        ) : scans.map((s) => (
          <div key={s.id} className="glass-card p-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
              {s.right_hand_photo ? <Thumb uri={s.right_hand_photo} /> : <Hand size={16} className="text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm truncate">{TYPE_LABELS[s.scan_type] || 'Lecture'}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(s.created_date).toLocaleDateString('fr-FR')}</p>
              <div className="flex gap-2 mt-1">
                <button onClick={() => navigate(`/lecture/${s.id}`)} className="text-[11px] text-primary">Consulter</button>
                <span className="text-muted-foreground">·</span>
                {s.status === 'analyzed' ? (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Lock size={10} /> Rapport 4,99 €</span>
                ) : null}
              </div>
            </div>
            <button onClick={() => setScanToDelete(s.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <button onClick={logout} className="btn-ghost-gold w-full py-3 flex items-center justify-center gap-2">
          <LogOut size={16} /> Se déconnecter
        </button>
        <button onClick={() => setAccountDeleteOpen(true)} className="w-full py-3 flex items-center justify-center gap-2 text-destructive border border-destructive/30 rounded-full text-sm">
          <Trash2 size={16} /> Supprimer mon compte et mes données
        </button>
      </div>

      <ConfirmDialog
        open={!!scanToDelete}
        onOpenChange={(o) => { if (!deletingScan) setScanToDelete(o ? scanToDelete : null); }}
        title="Supprimer ce scan ?"
        description="Ce scan et ses données associées seront supprimés définitivement. Cette action est irréversible."
        confirmLabel="Supprimer"
        destructive
        loading={deletingScan}
        onConfirm={confirmDeleteScan}
      />
      <ConfirmDialog
        open={accountDeleteOpen}
        onOpenChange={(o) => { if (!deletingAccount) setAccountDeleteOpen(o); }}
        title="Supprimer votre compte ?"
        description="Votre compte, vos scans, lectures et compatibilités seront supprimés définitivement. Les abonnements Google Play doivent être résiliés séparément depuis Google Play."
        confirmLabel="Tout supprimer"
        destructive
        loading={deletingAccount}
        onConfirm={confirmDeleteAccount}
      />
      <ErrorDialog open={!!error} onOpenChange={setError} description={error} />

      <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
        Vos photographies sont stockées de manière privée et accessibles uniquement à vous. Elles ne sont pas utilisées pour entraîner des modèles.
      </p>
    </div>
  );
}

function Thumb({ uri }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    (async () => {
      try { const r = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri }); setUrl(r.signed_url); } catch (e) {}
    })();
  }, [uri]);
  return url ? <img src={url} alt="main" className="w-full h-full object-cover" /> : <Hand size={16} className="text-muted-foreground" />;
}