import React, { useEffect, useState } from "react";
import { Heart, Loader2, Share2, Copy, Check, X, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ReadingMarkdown from "@/components/ReadingMarkdown";

export default function Compatibility() {
  const [view, setView] = useState('home'); // home | create | waiting | result | accept
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [compat, setCompat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const page = await base44.entities.Scan.filter({ scan_type: 'compatibility', status: 'analyzed' }, { sort: '-created_date', limit: 20, fields: ['id', 'created_date'] });
      setScans(page.items || []);
      const cPage = await base44.entities.Compatibility.filter({}, { sort: '-created_date', limit: 10 });
      const mine = (cPage.items || []).find((c) => c.status === 'completed' && c.result_content);
      if (mine) { setCompat(mine); setView('result'); }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");
    if (codeParam) { setCode(codeParam); setView("accept"); }
    load();
  }, []);

  // Participant A: poll the invitation until the invitee accepts and the reading is ready.
  useEffect(() => {
    if (view !== "waiting" || !compat) return;
    const id = setInterval(async () => {
      try {
        const fresh = await base44.entities.Compatibility.get(compat.id);
        if (fresh.status === "completed" && fresh.result_content) {
          setCompat(fresh);
          setView("result");
        } else if (fresh.status === "cancelled") {
          setView("home");
          setCompat(null);
        }
      } catch (e) {}
    }, 5000);
    return () => clearInterval(id);
  }, [view, compat]);

  const createInvitation = async () => {
    setBusy(true);
    setError("");
    try {
      const scanId = selectedScan || scans[0]?.id;
      if (!scanId) { setError("Sélectionnez un scan de votre main droite."); setBusy(false); return; }
      const me = await base44.auth.me();
      const invitation_code = (crypto.randomUUID?.() || String(Date.now())).replace(/-/g, '').slice(0, 10);
      const c = await base44.entities.Compatibility.create({
        participant_a_id: me.id,
        scan_a_id: scanId,
        invitation_code,
        status: 'pending',
        consent_a: true,
      });
      setCompat(c);
      setView('waiting');
    } catch (e) { setError("Impossible de créer l'invitation."); }
    setBusy(false);
  };

  const acceptWithCode = async () => {
    setBusy(true);
    setError("");
    try {
      const page = await base44.entities.Compatibility.filter({ invitation_code: code.trim() }, { limit: 1 });
      const c = page.items?.[0];
      if (!c) { setError("Code d'invitation introuvable."); setBusy(false); return; }
      const me = await base44.auth.me();
      const myScans = await base44.entities.Scan.filter({ scan_type: 'compatibility', status: 'analyzed' }, { sort: '-created_date', limit: 1 });
      if (!myScans.items?.length) { setError("Analysez d'abord votre main droite dans l'onglet Mes mains."); setBusy(false); return; }
      await base44.entities.Compatibility.update(c.id, {
        participant_b_id: me.id,
        scan_b_id: myScans.items[0].id,
        consent_b: true,
        status: 'accepted',
      });
      // Generate the compatibility reading server-side (service role LLM).
      await base44.functions.invoke('analyzeCompatibility', { compatibility_id: c.id });
      const done = await base44.entities.Compatibility.get(c.id);
      setCompat(done);
      setView('result');
    } catch (e) { setError("Impossible d'accepter l'invitation."); }
    setBusy(false);
  };

  const cancelInvitation = async () => {
    if (!compat) return;
    try { await base44.entities.Compatibility.update(compat.id, { status: 'cancelled' }); setView('home'); setCompat(null); } catch (e) {}
  };

  const shareUrl = compat ? `${window.location.origin}/compatibilite?code=${compat.invitation_code}` : "";
  const copy = () => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="px-6 pt-12 pb-6 max-w-md mx-auto">
      <header className="mb-6 text-center">
        <Heart size={28} className="mx-auto text-primary mb-2" />
        <h1 className="font-display text-3xl">Compatibilité amoureuse</h1>
        <p className="text-sm text-muted-foreground mt-1">Comparez symboliquement vos mains droites à deux.</p>
      </header>

      {view === 'home' && (
        <div className="space-y-3">
          <button onClick={() => setView('create')} className="btn-gold w-full py-3">Inviter une personne</button>
          <button onClick={() => setView('accept')} className="btn-ghost-gold w-full py-3 flex items-center justify-center gap-2">
            <Link2 size={16} /> J'ai un code d'invitation
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-4 leading-relaxed">
            Gratuit. La compatibilité est une lecture symbolique, non une prédiction de réussite ou d'échec d'une relation.
          </p>
        </div>
      )}

      {view === 'create' && (
        <div className="space-y-4">
          <h2 className="font-display text-xl">Choisissez votre main droite</h2>
          {scans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun scan de compatibilité. Allez dans Mes mains pour scanner votre main droite (parcours Compatibilité).</p>
          ) : (
            <div className="space-y-2">
              {scans.map((s, i) => (
                <button key={s.id} onClick={() => setSelectedScan(s.id)} className={`glass-card w-full text-left p-3 flex items-center gap-3 ${selectedScan === s.id ? 'border-primary' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm">{i + 1}</div>
                  <span className="text-sm">{new Date(s.created_date).toLocaleDateString('fr-FR')}</span>
                  {selectedScan === s.id && <Check size={16} className="ml-auto text-primary" />}
                </button>
              ))}
            </div>
          )}
          <button onClick={createInvitation} disabled={busy} className="btn-gold w-full py-3 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />} Créer l'invitation
          </button>
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
          <button onClick={() => setView('home')} className="text-xs text-muted-foreground w-full">Retour</button>
        </div>
      )}

      {view === 'waiting' && compat && (
        <div className="space-y-4 text-center">
          <Loader2 className="animate-spin text-primary mx-auto" size={28} />
          <h2 className="font-display text-xl">En attente de votre invité</h2>
          <p className="text-sm text-muted-foreground">Partagez ce lien à une seule personne.</p>
          <div className="glass-card p-3 flex items-center gap-2">
            <span className="text-xs text-primary truncate flex-1 text-left">{shareUrl}</span>
            <button onClick={copy} className="text-primary">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Code de secours : {compat.invitation_code}</p>
          <button onClick={cancelInvitation} className="btn-ghost-gold w-full py-3 flex items-center justify-center gap-2">
            <X size={16} /> Annuler l'invitation
          </button>
        </div>
      )}

      {view === 'accept' && (
        <div className="space-y-4">
          <h2 className="font-display text-xl">Entrez le code d'invitation</h2>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code à 10 caractères"
            className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button onClick={acceptWithCode} disabled={busy} className="btn-gold w-full py-3 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Accepter et participer
          </button>
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
          <button onClick={() => setView('home')} className="text-xs text-muted-foreground w-full">Retour</button>
        </div>
      )}

      {view === 'result' && compat && (
        <div className="space-y-4">
          <div className="gold-divider" />
          <h2 className="font-display text-2xl text-primary text-center">Votre compatibilité</h2>
          <ReadingMarkdown>{compat.result_content || "Résultat en cours de finalisation."}</ReadingMarkdown>
          <button onClick={() => setView('home')} className="btn-ghost-gold w-full py-3">Nouvelle compatibilité</button>
        </div>
      )}
    </div>
  );
}