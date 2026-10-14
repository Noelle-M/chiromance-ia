import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Download, Sparkles, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";
import PalmCanvas from "@/components/PalmCanvas";
import { generateReportPdf } from "@/lib/generateReportPdf";

// Ensures every line is its own block so markdown renders as separate paragraphs/headings, not one slab.
const normalizeMd = (md) => {
  if (!md) return "";
  let s = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/\n/g, "\n\n");      // turn every line break into a paragraph break
  s = s.replace(/\n{3,}/g, "\n\n");   // collapse extra blanks
  return s;
};

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
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  const load = async () => {
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
      const readPage = await base44.entities.Reading.filter({ scan_id: scanId }, { sort: '-created_date', limit: 1 });
      if (readPage.items?.length) {
        setReading(readPage.items[0]);
        const repPage = await base44.entities.Report.filter({ reading_id: readPage.items[0].id }, { limit: 1 });
        if (repPage.items?.length) {
          setReport(repPage.items[0]);
          if (repPage.items[0].pdf_file_uri) {
            try {
              const r = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: repPage.items[0].pdf_file_uri });
              setPdfUrl(r.signed_url);
            } catch (e) {}
          }
        }
      }
    } catch (e) { setError("Lecture introuvable."); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [scanId]);

  const handleReveal = async () => {
    // Payment is a placeholder until store in-app purchases are configured.
    setBusy(true);
    setError("");
    try {
      if (!report) {
        const rep = await base44.entities.Report.create({ reading_id: reading.id, scan_id: scanId, purchase_status: 'locked' });
        setReport(rep);
      }
      setError("Le paiement (4,99 €) sera activé lors du branchement des achats intégrés Google Play / App Store. En mode développement, le rapport complet est débloqué manuellement.");
      // Dev unlock for demonstration
      await base44.entities.Report.update(report?.id || (await base44.entities.Report.filter({ reading_id: reading.id }, { limit: 1 })).items[0].id, { purchase_status: 'unlocked' });
      const repPage = await base44.entities.Report.filter({ reading_id: reading.id }, { limit: 1 });
      if (repPage.items?.length) setReport(repPage.items[0]);
    } catch (e) { setError("Action impossible pour le moment."); }
    setBusy(false);
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
      const file = new File([blob], `rapport-${scanId}.pdf`, { type: 'application/pdf' });
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await base44.entities.Report.update(report.id, { pdf_file_uri: file_uri });
      const r = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
      setPdfUrl(r.signed_url);
      const repPage = await base44.entities.Report.filter({ reading_id: reading.id }, { limit: 1 });
      if (repPage.items?.length) setReport(repPage.items[0]);
    } catch (e) { setError("La génération du PDF a échoué."); }
    setPdfBusy(false);
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-primary" /></div>;
  if (error && !scan) return (
    <div className="px-6 pt-20 text-center text-sm text-muted-foreground">{error} <Link to="/mes-mains" className="text-primary underline">Retour</Link></div>
  );

  const unlocked = report?.purchase_status === 'unlocked';
  const rightObs = observations.filter((o) => o.hand === 'right');
  const leftObs = observations.filter((o) => o.hand === 'left');

  return (
    <div className="px-5 pt-10 pb-8 max-w-md mx-auto">
      <Link to="/mes-mains" className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
        <ArrowLeft size={16} /> Mes mains
      </Link>

      <h1 className="font-display text-3xl mb-1">Votre lecture</h1>
      <p className="text-xs text-muted-foreground mb-5">
        {new Date(scan.created_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {scan.status === 'analyzing' && (
        <div className="flex items-center gap-2 text-sm text-primary mb-4"><Loader2 className="animate-spin" size={16} /> Analyse en cours…</div>
      )}
      {scan.status === 'failed' && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
          <AlertCircle size={14} className="mt-0.5" />
          <span>Cette photo n'a pas pu être analysée. {scan.quality_notes || ''}</span>
        </div>
      )}

      {reading ? (
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
              <p className="text-xs text-muted-foreground mt-1">Confiance : {(selected.confidence * 100).toFixed(0)}%{selected.uncertain ? ' · incertain' : ''}</p>
              {selected.characteristics && <p className="text-sm mt-2 leading-relaxed">{selected.characteristics}</p>}
            </div>
          )}

          <div className="prose-reading">
            <ReactMarkdown>{normalizeMd(reading.free_content)}</ReactMarkdown>
          </div>

          <div className="gold-divider my-6" />

          {unlocked ? (
            <div>
              <h2 className="font-display text-2xl text-primary mb-3">Rapport complet</h2>
              <div className="prose-reading">
                <ReactMarkdown>{normalizeMd(reading.full_content)}</ReactMarkdown>
              </div>
              <div className="gold-divider my-5" />
              {pdfUrl ? (
                <a href={pdfUrl} download={`rapport-chiromance-${scanId}.pdf`} target="_blank" rel="noreferrer" className="btn-gold w-full flex items-center justify-center gap-2 py-3">
                  <Download size={16} /> Télécharger mon rapport PDF
                </a>
              ) : (
                <button onClick={generatePdf} disabled={pdfBusy} className="btn-gold w-full flex items-center justify-center gap-2 py-3">
                  {pdfBusy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                  {report?.pdf_file_uri ? 'Rouvrir le rapport PDF' : 'Générer mon rapport PDF'}
                </button>
              )}
              <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed">
                Votre rapport est enregistré dans votre compte. Téléchargeable à volonté, sans nouveau paiement.
              </p>
            </div>
          ) : (
            <button onClick={handleReveal} disabled={busy} className="btn-gold w-full flex items-center justify-center gap-2 py-4">
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Lock size={16} />}
              Révéler tous les secrets de mes mains — 4,99 €
            </button>
          )}
          {error && <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed">{error}</p>}
        </>
      ) : (
        <div className="glass-card p-6 text-center">
          <Sparkles size={24} className="mx-auto text-primary/50 mb-3" />
          <p className="text-sm text-muted-foreground">Aucune lecture générée pour ce scan.</p>
        </div>
      )}
    </div>
  );
}