import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Download, Sparkles, AlertCircle } from "lucide-react";
import ReadingMarkdown from "@/components/ReadingMarkdown";
import ReportAccordion from "@/components/ReportAccordion";
import ChatPanel from "@/components/ChatPanel";
import { base44 } from "@/api/base44Client";
import PalmCanvas from "@/components/PalmCanvas";
import { generateReportPdf } from "@/lib/generateReportPdf";
import { buyReport, subscribeQuestions, restorePurchases, PLAY_PRODUCTS } from "@/lib/googlePlayBilling";

export default function Reading() {
  const { scanId } = useParams();
  const [scan, setScan] = useState(null);
  const [observations, setObservations] = useState([]);
  const [reading, setReading] = useState(null);
  const [report, setReport] = useState(null);
  const [rightUrl, setRightUrl] = useState(null);
  const [leftUrl, setLeftUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deepBusy, setDeepBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatSubscribed, setChatSubscribed] = useState(false);
  const [reportEntitled, setReportEntitled] = useState(false);
  const [freeQuestionCount, setFreeQuestionCount] = useState(0);
  const [subscribeBusy, setSubscribeBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [subNotice, setSubNotice] = useState("");

  const FREE_QUESTIONS = 3;

  const loadAll = async () => {
    setLoading(true);
    try {
      const s = await base44.entities.Scan.get(scanId);
      setScan(s);
      if (s.right_hand_photo) {
        try { const r = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: s.right_hand_photo }); setRightUrl(r.signed_url); } catch (e) {}
      }
      if (s.left_hand_photo) {
        try { const r = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: s.left_hand_photo }); setLeftUrl(r.signed_url); } catch (e) {}
      }
      const obsPage = await base44.entities.Observation.filter({ scan_id: scanId }, { limit: 100 });
      setObservations(obsPage.items || []);

      const readPage = await base44.entities.Reading.filter({ scan_id: scanId }, { sort: "-created_date", limit: 1 });
      const currentReading = readPage.items?.[0] || null;

      const msgPage = await base44.entities.ChatMessage.filter({ scan_id: scanId }, { sort: "created_date", limit: 50 });
      const msgs = msgPage.items || [];
      setChatMessages(msgs);

      try {
        const me = await base44.auth.me();
        const entitlements = await base44.entities.PlayEntitlement.filter({ product_id: 'chiromancia_questions_illimitees', status: 'active' });
        setChatSubscribed((entitlements.items || []).some((r) => r.user_id === me.id && r.expires_at && Date.parse(r.expires_at) > Date.now()));
        const reportRights = await base44.entities.PlayEntitlement.filter({ product_id: 'chiromancia_rapport_complet', scan_id: scanId, status: 'active' });
        setReportEntitled((reportRights.items || []).some((r) => r.user_id === me.id));
        const used = await base44.entities.ChatMessage.count({ role: 'user', created_by_id: me.id, kind: { $in: ['chat', 'revision'] } });
        setFreeQuestionCount(used || 0);
      } catch (e) {}

      if (currentReading) {
        setReading(currentReading);
        const repPage = await base44.entities.Report.filter({ reading_id: currentReading.id }, { limit: 1 });
        if (repPage.items?.length) {
          setReport(repPage.items[0]);
          if (repPage.items[0].pdf_file_uri) {
            try { const r = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: repPage.items[0].pdf_file_uri }); setPdfUrl(r.signed_url); } catch (e) {}
          }
        }
      }

      // Nouveau scan sans lecture : on génère la lecture initiale via GPT-4.1.
      if (!currentReading && msgs.length === 0) {
        await generateInitialReading();
      }
    } catch (e) {
      setError("Lecture introuvable.");
    }
    setLoading(false);
  };

  const generateInitialReading = async () => {
    setGenerating(true);
    setError("");
    try {
      await base44.functions.invoke("chatPalm", { scan_id: scanId, mode: "reading" });
      const readPage = await base44.entities.Reading.filter({ scan_id: scanId }, { sort: "-created_date", limit: 1 });
      if (readPage.items?.length) setReading(readPage.items[0]);
      const msgPage = await base44.entities.ChatMessage.filter({ scan_id: scanId }, { sort: "created_date", limit: 50 });
      setChatMessages(msgPage.items || []);
    } catch (e) {
      setError("La génération de la lecture a échoué. Réessayez plus tard.");
    }
    setGenerating(false);
  };

  useEffect(() => { loadAll(); }, [scanId]);

  const sendChat = async (text, signalMismatch) => {
    if (!chatSubscribed && freeQuestionCount >= FREE_QUESTIONS) return;
    setChatBusy(true);
    setError("");
    const userMsg = { id: "tmp-" + Date.now(), scan_id: scanId, role: "user", content: text, kind: signalMismatch ? "revision" : "chat" };
    setChatMessages((m) => [...m, userMsg]);
    if (!chatSubscribed) setFreeQuestionCount((c) => c + 1);
    try {
      const res = await base44.functions.invoke("chatPalm", { scan_id: scanId, mode: "chat", message: text, signal_mismatch: signalMismatch });
      const reply = res.data?.reply || "";
      setChatMessages((m) => [...m, { id: "a-" + Date.now(), scan_id: scanId, role: "assistant", content: reply, kind: signalMismatch ? "revision" : "chat" }]);
    } catch (e) {
      setError("La chiromancienne ne peut pas répondre pour le moment.");
      setChatMessages((m) => m.filter((x) => x.id !== userMsg.id));
    }
    setChatBusy(false);
  };

  const subscribeChat = async () => {
    setSubscribeBusy(true);
    setSubNotice("");
    try {
      const result = await subscribeQuestions();
      if (result.success && result.purchaseToken) {
        const verified = await base44.functions.invoke('verifyPlayPurchase', { productId: 'chiromancia_questions_illimitees', purchaseToken: result.purchaseToken });
        if (verified.data?.verified) { setChatSubscribed(true); setSubNotice('Abonnement actif.'); }
        else setSubNotice('Paiement en attente de validation.');
      } else setSubNotice(!result.available ? 'Achats Google Play indisponibles sur cette version.' : 'Abonnement non activé : ' + (result.error || 'paiement non confirmé.'));
    } catch (e) {
      setSubNotice("Souscription impossible pour le moment.");
    }
    setSubscribeBusy(false);
  };

  const restorePlayRights = async () => {
    setRestoreBusy(true);
    setSubNotice("");
    try {
      const result = await restorePurchases();
      if (!result.available) { setSubNotice("Restauration disponible dans l'application Android."); return; }
      let restored = 0;
      for (const purchase of (result.purchases || [])) {
        const products = purchase.products || [];
        if (products.includes(PLAY_PRODUCTS.questions)) {
          const verified = await base44.functions.invoke("verifyPlayPurchase", {
            productId: PLAY_PRODUCTS.questions, purchaseToken: purchase.purchaseToken,
          });
          if (verified.data?.verified) { setChatSubscribed(true); restored++; }
        }
        if (products.includes(PLAY_PRODUCTS.report)) {
          const verified = await base44.functions.invoke("verifyPlayPurchase", {
            productId: PLAY_PRODUCTS.report, purchaseToken: purchase.purchaseToken, scanId,
          });
          if (verified.data?.verified) { setReportEntitled(true); restored++; }
        }
      }
      setSubNotice(restored ? "Vos achats ont été restaurés." : "Aucun achat actif à restaurer pour cette lecture.");
    } catch (e) {
      setSubNotice("Impossible de restaurer les achats pour le moment.");
    } finally {
      setRestoreBusy(false);
    }
  };

  const handleReveal = async () => {
    setBusy(true);
    setError("");
    try {
      let rep = report;
      if (!rep) {
        rep = await base44.entities.Report.create({ reading_id: reading.id, scan_id: scanId, purchase_status: "locked" });
        setReport(rep);
      }
      const payment = await buyReport();
      if (!payment.available) { setError('Achats Google Play indisponibles sur cette version.'); return; }
      if (!payment.success || !payment.purchaseToken) { setError('Paiement non confirmé.'); return; }
      const verified = await base44.functions.invoke('verifyPlayPurchase', { productId: 'chiromancia_rapport_complet', purchaseToken: payment.purchaseToken, scanId });
      if (!verified.data?.verified) { setError('Achat en attente de validation.'); return; }
      setReportEntitled(true);
      // Génère la lecture approfondie uniquement après vérification Google Play.
      if (!reading.full_content) {
        setDeepBusy(true);
        try {
          await base44.functions.invoke("chatPalm", { scan_id: scanId, mode: "deep" });
          const rp = await base44.entities.Reading.filter({ scan_id: scanId }, { sort: "-created_date", limit: 1 });
          if (rp.items?.length) setReading(rp.items[0]);
        } catch (e) {
          setError("La génération de la lecture approfondie a échoué.");
          setDeepBusy(false);
          setBusy(false);
          return;
        }
        setDeepBusy(false);
      }
      setReport((current) => ({ ...current, purchase_status: 'unlocked' }));
      setError('Paiement vérifié. Rapport complet disponible.');
    } catch (e) {
      setError("Action impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  const regenerateDeep = async () => {
    if (!reportEntitled) return;
    setDeepBusy(true);
    setError("");
    try {
      await base44.functions.invoke("chatPalm", { scan_id: scanId, mode: "deep" });
      const rp = await base44.entities.Reading.filter({ scan_id: scanId }, { sort: "-created_date", limit: 1 });
      if (rp.items?.length) setReading(rp.items[0]);
      setPdfUrl(null);
      await base44.entities.Report.update(report.id, { pdf_file_uri: "" });
    } catch (e) {
      setError("La nouvelle lecture approfondie n'a pas pu être générée.");
    } finally {
      setDeepBusy(false);
    }
  };

  const generatePdf = async () => {
    setPdfBusy(true);
    setError("");
    try {
      const blob = await generateReportPdf({
        reading, observations,
        rightPhotoUrl: rightUrl, leftPhotoUrl: leftUrl,
        scanDate: scan.created_date,
      });
      const file = new File([blob], `rapport-${scanId}.pdf`, { type: "application/pdf" });
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await base44.entities.Report.update(report.id, { pdf_file_uri: file_uri });
      const r = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
      setPdfUrl(r.signed_url);
      const repPage = await base44.entities.Report.filter({ reading_id: reading.id }, { limit: 1 });
      if (repPage.items?.length) setReport(repPage.items[0]);
    } catch (e) {
      setError("La génération du PDF a échoué.");
    }
    setPdfBusy(false);
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-primary" /></div>;
  if (error && !scan) return (
    <div className="px-6 pt-20 text-center text-sm text-muted-foreground">{error} <Link to="/mes-mains" className="text-primary underline">Retour</Link></div>
  );

  const unlocked = reportEntitled;
  const rightObs = observations.filter((o) => o.hand === "right");
  const leftObs = observations.filter((o) => o.hand === "left");
  const chatVisible = chatMessages.filter((m) => m.kind === "chat" || m.kind === "revision");

  return (
    <div className="px-5 pt-10 pb-8 max-w-md mx-auto">
      <Link to="/mes-mains" className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
        <ArrowLeft size={16} /> Mes mains
      </Link>

      <h1 className="font-display text-3xl mb-1">Votre lecture</h1>
      <p className="text-xs text-muted-foreground mb-5">
        {scan?.created_date ? new Date(scan.created_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""}
      </p>

      {scan?.status === "analyzing" && (
        <div className="flex items-center gap-2 text-sm text-primary mb-4"><Loader2 className="animate-spin" size={16} /> Analyse en cours…</div>
      )}
      {scan?.status === "failed" && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
          <AlertCircle size={14} className="mt-0.5" />
          <span>Cette photo n'a pas pu être analysée. {scan.quality_notes || ""}</span>
        </div>
      )}

      {generating ? (
        <div className="glass-card p-6 text-center">
          <Loader2 className="animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Génération de votre lecture par la chiromancienne…</p>
        </div>
      ) : reading ? (
        <>
          <div className="mb-6">
            <h2 className="font-display text-xl text-primary/90 mb-3">Main droite</h2>
            <PalmCanvas photoUrl={rightUrl} observations={rightObs} onSelect={setSelected} />
          </div>
          {leftUrl && (
            <div className="mb-6">
              <h2 className="font-display text-xl text-primary/90 mb-3">Main gauche</h2>
              <PalmCanvas photoUrl={leftUrl} observations={leftObs} onSelect={setSelected} />
            </div>
          )}

          {selected && (
            <div className="glass-card p-4 mb-6">
              <p className="font-display text-lg text-primary">{selected.line_label || selected.line_name}</p>
              <p className="text-xs text-muted-foreground mt-1">Confiance : {(selected.confidence * 100).toFixed(0)}%{selected.uncertain ? " · incertain" : ""}</p>
              {selected.characteristics && <p className="text-sm mt-2 leading-relaxed">{selected.characteristics}</p>}
            </div>
          )}

          <ReadingMarkdown showLineColors>{reading.free_content}</ReadingMarkdown>

          <div className="gold-divider my-6" />

          <ChatPanel
            messages={chatVisible}
            onSend={sendChat}
            busy={chatBusy}
            blocked={!chatSubscribed && freeQuestionCount >= FREE_QUESTIONS}
            remaining={Math.max(0, FREE_QUESTIONS - freeQuestionCount)}
            subscribed={chatSubscribed}
            onSubscribe={subscribeChat}
            subscribeBusy={subscribeBusy}
            subNotice={subNotice}
          />

          <div className="gold-divider my-6" />

          {unlocked ? (
            <div>
              <h2 className="font-display text-2xl text-primary mb-3">Rapport complet</h2>
              <p className="text-xs text-muted-foreground mb-4">Touchez un chapitre pour afficher son interprétation.</p>
              <ReportAccordion content={reading.full_content} />
              <div className="gold-divider my-5" />
              {pdfUrl ? (
                <div className="space-y-3">
                  <a href={pdfUrl} download={`rapport-chiromance-${scanId}.pdf`} target="_blank" rel="noreferrer" className="btn-gold w-full flex items-center justify-center gap-2 py-3">
                    <Download size={16} /> Télécharger mon rapport PDF
                  </a>
                </div>
              ) : (
                <button onClick={generatePdf} disabled={pdfBusy} className="btn-gold w-full flex items-center justify-center gap-2 py-3">
                  {pdfBusy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                  {report?.pdf_file_uri ? "Rouvrir le rapport PDF" : "Générer mon rapport PDF"}
                </button>
              )}
              <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed">
                Votre rapport est enregistré dans votre compte. Téléchargeable à volonté, sans nouveau paiement.
              </p>
            </div>
          ) : (
            <button onClick={handleReveal} disabled={busy || deepBusy} className="btn-gold w-full flex items-center justify-center gap-2 py-4">
              {busy || deepBusy ? <Loader2 className="animate-spin" size={18} /> : <Lock size={16} />}
              {deepBusy ? "Génération de la lecture approfondie…" : (<span className="text-center leading-tight">Révéler mon rapport complet<br /><span className="text-sm opacity-90">4,99 € · paiement unique</span></span>)}
            </button>
          )}
          <button onClick={restorePlayRights} disabled={restoreBusy} className="w-full text-xs text-primary underline mt-4 py-2">{restoreBusy ? "Restauration en cours…" : "Restaurer mes achats Google Play"}</button>
          {subNotice && <p className="text-[11px] text-muted-foreground text-center mt-2">{subNotice}</p>}
          {error && <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed">{error}</p>}
        </>
      ) : (
        <div className="glass-card p-6 text-center">
          <Sparkles size={24} className="mx-auto text-primary/50 mb-3" />
          <p className="text-sm text-muted-foreground">Aucune lecture générée pour ce scan.</p>
          <button onClick={generateInitialReading} className="btn-gold mt-3 px-4 py-2 text-sm">Générer ma lecture</button>
        </div>
      )}
    </div>
  );
}