import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Loader2, Share2, Copy, Check, X, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ReadingMarkdown from "@/components/ReadingMarkdown";
import ReactMarkdown from "react-markdown";
import { ChevronDown } from "lucide-react";

export default function Compatibility() {
  const navigate = useNavigate();
  const [view, setView] = useState('home'); // home | create | waiting | result | accept
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [compat, setCompat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const acceptingRef = React.useRef(false);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const [readyNotice, setReadyNotice] = useState(false);
  const [openSection, setOpenSection] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const page = await base44.entities.Scan.filter({ scan_type: 'compatibility', status: 'analyzed' }, { sort: '-created_date', limit: 20, fields: ['id', 'created_by_id', 'right_hand_photo', 'created_date'] });
      const currentUser = await base44.auth.me();
      setScans((page.items || []).filter((scan) => scan.created_by_id === currentUser.id));
      const cPage = await base44.functions.invoke('listMyCompatibilities', {});
      const params = new URLSearchParams(window.location.search);
      if (!params.has('code')) {
        const requestedId = params.get('id');
        const requestedEntry = requestedId ? (cPage.data?.entries || []).find((entry) => entry.id === requestedId) : null;
        if (requestedEntry && requestedEntry.status === 'completed' && requestedEntry.result_content) {setCompat(requestedEntry);setReadyNotice(false);setView('result');} else
        if (requestedEntry && ['pending', 'accepted'].includes(requestedEntry.status)) {setCompat(requestedEntry);setView('waiting');} else
        if (requestedId) {setError('Cette compatibilité est indisponible.');setView('home');} else
        {
          const requestedScan = params.get('scan');
          const related = requestedScan ? (cPage.data?.entries || []).find((c) => c.scan_a_id === requestedScan || c.scan_b_id === requestedScan) : null;
          if (related && related.status === 'completed' && related.result_content) {setCompat(related);setReadyNotice(false);setView('result');} else
          if (related && ['pending', 'accepted'].includes(related.status)) {setCompat(related);setView('waiting');} else
          if (requestedScan) {setSelectedScan(requestedScan);setView('create');} else
          {
            const pending = (cPage.data?.entries || []).find((c) => c.status === 'pending' && c.invitation_code);
            const accepted = (cPage.data?.entries || []).find((c) => c.status === 'accepted');
            const completed = (cPage.data?.entries || []).find((c) => c.status === 'completed' && c.result_content);
            if (pending) {setCompat(pending);setView('waiting');} else
            if (accepted) {setCompat(accepted);setView('waiting');} else
            if (completed) {setCompat(completed);setReadyNotice(Boolean(completed.is_initiator));setView('result');}
          }
        }
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");
    const scanParam = params.get("scan");
    if (codeParam) sessionStorage.setItem('chiromancia_compat_invite', codeParam);
    if (scanParam) {setSelectedScan(scanParam);if (!codeParam) setView("create");}
    if (codeParam) {setCode(codeParam);setView("accept");}
    load();
  }, []);

  // Participant A: poll the invitation until the invitee accepts and the reading is ready.
  useEffect(() => {
    if (view !== "waiting" || !compat) return;
    const check = async () => {
      try {
        const state = await base44.functions.invoke('getCompatibilityState', { compatibilityId: compat.id });
        const fresh = state.data?.compatibility;
        if (!fresh) return;
        if (fresh.status === 'accepted' && compat.status !== 'accepted') {setCompat(fresh);} else if (fresh.status === "completed" && fresh.result_content) {
          setCompat(fresh);
          setReadyNotice(true);
          setView("result");
        } else if (fresh.status === "cancelled") {
          setView("home");
          setCompat(null);
        }
      } catch (e) {}
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [view, compat]);

  const createInvitation = async () => {
    setBusy(true);
    setError("");
    try {
      const scanId = selectedScan || scans[0]?.id;
      if (!scanId) {setError("Sélectionnez un scan de votre main droite.");setBusy(false);return;}
      const response = await base44.functions.invoke('createCompatibilityInvite', { scanId });
      if (!response.data?.compatibility) throw new Error('invitation_failed');
      setCompat(response.data.compatibility);
      setView('waiting');
    } catch (e) {setError("Impossible de créer l'invitation.");}
    setBusy(false);
  };

  const acceptWithCode = async () => {
    if (acceptingRef.current) return;
    acceptingRef.current = true;
    setBusy(true);
    setError("");
    let acceptedCompatibility = null;
    try {
      const scanFromCapture = new URLSearchParams(window.location.search).get('scan');
      const myScans = scanFromCapture ? { items: [{ id: scanFromCapture }] } : { items: [] };
      if (!myScans.items?.length) {acceptingRef.current = false;setBusy(false);navigate(`/scanner?compatInvite=${encodeURIComponent(code.trim())}`);return;}
      const accepted = await base44.functions.invoke('acceptCompatibilityInvite', { code: code.trim(), scanId: myScans.items[0].id });
      const c = accepted.data?.compatibility;
      if (!c) throw new Error('invitation_invalid');
      acceptedCompatibility = c;
      // Generate the compatibility reading server-side (service role LLM).
      const analysis = await base44.functions.invoke('analyzeCompatibility', { compatibility_id: c.id });
      if (analysis.data?.error) throw new Error(analysis.data.message || analysis.data.error);
      const done = await base44.functions.invoke('getCompatibilityState', { compatibilityId: c.id });
      setCompat(done.data.compatibility);
      setView(done.data.compatibility.status === 'completed' ? 'result' : 'waiting');
      sessionStorage.removeItem('chiromancia_compat_invite');
    } catch (e) {
      setError(e?.response?.data?.message || e?.response?.data?.error || e.message || "Impossible de terminer l'analyse.");
      if (acceptedCompatibility) {setAnalysisFailed(true);setCompat(acceptedCompatibility);setView('waiting');sessionStorage.removeItem('chiromancia_compat_invite');}
    }
    setBusy(false);
    acceptingRef.current = false;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (loading || busy || view !== 'accept' || !params.has('code')) return;
    if (params.has('scan')) {
      if (!acceptingRef.current) acceptWithCode();
    } else {
      navigate('/scanner?compatInvite=' + encodeURIComponent(params.get('code')), { replace: true });
    }
  }, [loading, view, busy]);

  const retryAnalysis = async () => {
    if (!compat || compat.status !== 'accepted') return;
    setBusy(true);
    setAnalysisFailed(false);
    setError('');
    try {
      const response = await base44.functions.invoke('analyzeCompatibility', { compatibility_id: compat.id });
      if (response.data?.error) throw new Error(response.data.message || response.data.error);
      const state = await base44.functions.invoke('getCompatibilityState', { compatibilityId: compat.id });
      if (state.data?.compatibility?.status === 'completed') {setCompat(state.data.compatibility);setReadyNotice(true);setView('result');}
    } catch (e) {setAnalysisFailed(true);setError(e?.response?.data?.message || e?.response?.data?.error || e.message || "L'analyse n'a pas pu aboutir.");} finally
    {setBusy(false);}
  };

  const cancelInvitation = async () => {
    if (!compat) return;
    setBusy(true);
    setError('');
    try {
      const response = await base44.functions.invoke('cancelCompatibilityInvite', { compatibilityId: compat.id });
      if (!response.data?.ok) throw new Error('cancel_failed');
      setView('home');
      setCompat(null);
    } catch (e) {setError("Impossible d'annuler cette invitation. Réessayez.");} finally
    {setBusy(false);}
  };

  const publicOrigin = import.meta.env.VITE_PUBLIC_APP_URL || 'https://fair-palm-path-pro.base44.app';
  const shareUrl = compat?.invitation_code && publicOrigin ? `${publicOrigin.replace(/\/$/, '')}/compatibilite?code=${encodeURIComponent(compat.invitation_code)}` : "";
  const copy = async () => {
    try {await navigator.clipboard.writeText(shareUrl || compat?.invitation_code || '');setCopied(true);setTimeout(() => setCopied(false), 1500);}
    catch (e) {setError('Copie indisponible. Sélectionnez le lien pour le partager.');}
  };
  const share = async () => {
    if (!shareUrl) {await copy();return;}
    if (navigator.share) {
      try {await navigator.share({ title: 'Invitation Chiromancia', text: 'Comparons nos mains droites sur Chiromancia', url: shareUrl });return;}
      catch (e) {if (e.name === 'AbortError') return;}
    }
    await copy();
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="px-6 pt-12 pb-6 max-w-md mx-auto">
      <header className="mb-6 text-center">
        <Heart size={28} className="mx-auto text-primary mb-2" />
        <h1 className="font-display text-3xl">Compatibilité</h1>
        <p className="text-sm text-muted-foreground mt-1">Comparez vos mains droites : affinités, amour, amitié, travail et projets communs.</p>
      </header>

      {view === 'home' &&
      <div className="space-y-3">
          <button onClick={() => setView('create')} className="btn-gold w-full py-3">Inviter une personne</button>
          <button onClick={() => setView('accept')} className="btn-ghost-gold w-full py-3 flex items-center justify-center gap-2">
            <Link2 size={16} /> J'ai un code d'invitation
          </button>
          

        
        </div>
      }

      {view === 'create' &&
      <div className="space-y-4">
          <h2 className="font-display text-xl">Choisissez votre main droite</h2>
          {scans.length === 0 && !selectedScan ?
        <p className="text-sm text-muted-foreground">Aucun scan de compatibilité. Allez dans Mes mains pour scanner votre main droite (parcours Compatibilité).</p> :

        <div className="space-y-2">
              {scans.map((s, i) =>
          <button key={s.id} onClick={() => setSelectedScan(s.id)} className={`glass-card w-full text-left p-3 flex items-center gap-3 ${selectedScan === s.id ? 'border-primary' : ''}`}>
                  <CompatibilityPalmThumb uri={s.right_hand_photo} />
                  <span className="text-sm">{new Date(s.created_date).toLocaleDateString('fr-FR')}</span>
                  {selectedScan === s.id && <Check size={16} className="ml-auto text-primary" />}
                </button>
          )}
            </div>
        }
          {selectedScan && !scans.some((s) => s.id === selectedScan) && <p className="text-sm text-primary">Votre main droite est prête. Envoyez maintenant une invitation.</p>}
          <button onClick={createInvitation} disabled={busy} className="btn-gold w-full py-3 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />} Créer l'invitation
          </button>
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
          <button onClick={() => setView('home')} className="text-xs text-muted-foreground w-full">Retour</button>
        </div>
      }

      {view === 'waiting' && compat &&
      <div className="space-y-4 text-center">
          {busy && <Loader2 className="animate-spin text-primary mx-auto" size={28} />}
          <h2 className="font-display text-xl">{compat.status === 'accepted' ? (analysisFailed ? 'Lecture à reprendre' : 'Invitation acceptée') : 'En attente de votre invité'}</h2>
          <p className="text-sm text-muted-foreground">{compat.status === 'accepted' ? 'Votre invité a accepté. La lecture commune sera disponible ici.' : 'Partagez ce lien à une seule personne.'}</p>
          {compat.status === "pending" && !shareUrl && <p className="text-xs text-muted-foreground">Le lien public doit être configuré pour le partage depuis Android. Vous pouvez transmettre le code ci-dessous.</p>}
          {compat.status === "pending" && compat.invitation_code && <div className="glass-card p-3 flex items-center gap-2">
            <span className="text-xs text-primary truncate flex-1 text-left">{shareUrl || compat.invitation_code}</span>
            <button onClick={copy} className="text-primary">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
          </div>}
          {compat.status === "pending" && compat.invitation_code && <button onClick={share} className="btn-gold w-full py-3 flex items-center justify-center gap-2"><Share2 size={16} /> {shareUrl ? 'Partager l’invitation' : 'Copier le code d’invitation'}</button>}
          {compat.status === "pending" && compat.invitation_code && <p className="text-[11px] text-muted-foreground">Code de secours : {compat.invitation_code}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {compat.status === 'pending' && <button onClick={cancelInvitation} disabled={busy} className="btn-ghost-gold w-full py-3 flex items-center justify-center gap-2">
            <X size={16} /> Annuler cette invitation
          </button>}
          {compat.status === 'accepted' && <button onClick={retryAnalysis} disabled={busy} className="btn-gold w-full py-3">{busy ? 'Lecture des deux mains en cours…' : "Générer notre compatibilité à partir des deux photos"}</button>}
          {compat.status === 'accepted' && <button onClick={() => {setView('home');setCompat(null);}} className="btn-ghost-gold w-full py-3">Retour</button>}
        </div>
      }

      {view === 'accept' &&
      <div className="space-y-4">
          <h2 className="font-display text-xl">Entrez le code d'invitation</h2>
          <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code d’invitation"
          className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground" />
        
          <p className="text-sm text-muted-foreground">Après connexion, votre main droite sera photographiée pour être comparée à celle de la personne qui vous invite.</p>
          <button onClick={acceptWithCode} disabled={busy} className="btn-gold w-full py-3 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Accepter et participer
          </button>
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
          <button onClick={() => setView('home')} className="text-xs text-muted-foreground w-full">Retour</button>
        </div>
      }

      {view === 'result' && compat &&
      <div className="space-y-4">
          {readyNotice && <div role="status" className="glass-card p-4 text-center"><p className="text-primary font-display text-lg">Votre analyse de compatibilité est prête !</p><p className="text-sm mt-2">Votre invité a accepté et la lecture de vos deux mains est disponible.</p><button onClick={() => setReadyNotice(false)} className="text-primary text-xs mt-3">Masquer</button></div>}
          <div className="gold-divider" />
          <h2 className="font-display text-2xl text-primary text-center">Votre lecture de compatibilité</h2>
          <CompatibilityAccordion content={compat.result_content || ""} openSection={openSection} onToggle={(index) => setOpenSection((previous) => previous === index ? null : index)} />
          <button onClick={() => setView('home')} className="btn-ghost-gold w-full py-3">Nouvelle compatibilité</button>
        </div>
      }
    </div>);

}

function CompatibilityAccordion({ content, openSection, onToggle }) {
  const parts = String(content || '').replace(/\r\n?/g, '\n').split(/(?:^|\n)\s*#{1,3}\s+([^\n]+)\n/g);
  const sections = [];
  if (parts[0]?.trim()) sections.push({ title: 'Introduction', body: parts[0].trim() });
  for (let i = 1; i < parts.length; i += 2) {
    const title = (parts[i] || '').trim();
    const body = (parts[i + 1] || '').trim();
    if (title) sections.push({ title, body });
  }
  if (!sections.length && content) sections.push({ title: 'Votre analyse de compatibilité', body: content });
  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <div key={index} className="glass-card overflow-hidden">
          <button type="button" aria-expanded={openSection === index} onClick={() => onToggle(index)}
            className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left text-primary font-display text-xl">
            <span>{section.title}</span>
            <ChevronDown size={19} className={`shrink-0 transition-transform duration-200 ${openSection === index ? 'rotate-180' : ''}`} />
          </button>
          {openSection === index && (
            <div className="px-4 pb-5 prose-reading reading-markdown">
              <ReactMarkdown>{section.body}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


function CompatibilityPalmThumb({ uri }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let active = true;
    if (!uri) return;
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri })
      .then((result) => { if (active) setUrl(result.signed_url); })
      .catch(() => {});
    return () => { active = false; };
  }, [uri]);
  return (
    <div className="w-14 h-16 shrink-0 rounded-lg overflow-hidden border border-border/50 bg-primary/10 flex items-center justify-center">
      {url ? <img src={url} alt="Votre main droite" className="w-full h-full object-cover" /> : <span className="text-primary text-xs">Main</span>}
    </div>
  );
}
