import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookMarked, Loader2, Hand, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ReadingMarkdown from "@/components/ReadingMarkdown";

const LINE_LABELS = {
  life: "Ligne de vie", heart: "Ligne de cœur", head: "Ligne de tête",
  fate: "Ligne du destin", sun: "Ligne du Soleil", mercury: "Ligne de Mercure", secondary: "Ligne secondaire",
};

export default function Grimoire() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const scanPage = await base44.entities.Scan.filter(
          { status: "analyzed" },
          { sort: "-created_date", limit: 50, fields: ["id", "scan_type", "right_hand_photo", "left_hand_photo", "created_date"] }
        );
        const scans = scanPage.items || [];
        if (!scans.length) { setLoading(false); return; }

        const [obsPage, readPage] = await Promise.all([
          base44.entities.Observation.filter({}, { limit: 500 }),
          base44.entities.Reading.filter({}, { sort: "-created_date", limit: 500, fields: ["scan_id", "summary", "free_content"] }),
        ]);
        const obsByScan = {};
        (obsPage.items || []).forEach((o) => { (obsByScan[o.scan_id] = obsByScan[o.scan_id] || []).push(o); });
        const readByScan = {};
        (readPage.items || []).forEach((r) => { if (!readByScan[r.scan_id]) readByScan[r.scan_id] = r; });

        setEntries(scans.map((s) => ({
          scan: s,
          observations: obsByScan[s.id] || [],
          reading: readByScan[s.id] || null,
        })));
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="px-6 pt-12 pb-6 max-w-md mx-auto">
      <header className="mb-6 text-center">
        <BookMarked size={26} className="mx-auto text-primary mb-2" />
        <h1 className="font-display text-3xl">Mon grimoire</h1>
        <p className="text-sm text-muted-foreground mt-1">Vos mains annotées, vos lignes et leurs interprétations.</p>
      </header>

      {entries.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Hand size={28} className="mx-auto text-primary/50 mb-3" />
          <p className="text-sm text-muted-foreground">Votre grimoire se remplit à chaque analyse.</p>
          <Link to="/scanner" className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 mt-4 text-sm">Scanner mes mains</Link>
        </div>
      ) : (
        <div className="space-y-5">
          {entries.map(({ scan, observations, reading }) => (
            <div key={scan.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-muted-foreground">
                  {new Date(scan.created_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <Link to={`/lecture/${scan.id}`} className="text-[11px] text-primary underline">Lire la consultation</Link>
              </div>

              <div className="flex gap-3 mb-3">
                {scan.right_hand_photo && (
                  <AnnotatedThumb uri={scan.right_hand_photo} observations={observations.filter((o) => o.hand === "right")} label="Droite" />
                )}
                {scan.left_hand_photo && (
                  <AnnotatedThumb uri={scan.left_hand_photo} observations={observations.filter((o) => o.hand === "left")} label="Gauche" />
                )}
              </div>

              <h3 className="font-display text-base text-primary/90 mb-1.5">Lignes identifiées</h3>
              {observations.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune ligne majeure identifiée.</p>
              ) : (
                <ul className="space-y-1 mb-3">
                  {dedupeLines(observations).map((o) => (
                    <li key={o.hand + o.line_name} className="text-xs flex items-start gap-2">
                      <span className="text-primary mt-0.5">◆</span>
                      <span>
                        <span className="text-foreground">{o.line_label || LINE_LABELS[o.line_name] || o.line_name}</span>
                        {o.uncertain && <span className="text-muted-foreground"> · incertain</span>}
                        {o.characteristics && <span className="text-muted-foreground"> — {o.characteristics}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {reading && (
                <div className="mt-2 border-t border-border/50 pt-3">
                  <ReadingMarkdown>{excerpt(reading.summary || reading.free_content)}</ReadingMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function dedupeLines(obs) {
  const seen = new Set();
  const out = [];
  for (const o of obs) {
    const k = o.hand + o.line_name;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

function excerpt(text) {
  if (!text) return "";
  const stripped = text.replace(/^#+\s*/gm, "").trim();
  const firstPara = stripped.split(/\n\n/)[0] || stripped;
  return firstPara.length > 320 ? firstPara.slice(0, 320).trim() + "…" : firstPara;
}

function AnnotatedThumb({ uri, observations, label }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
        setUrl(signed_url);
      } catch (e) {}
    })();
  }, [uri]);

  return (
    <div className="flex-1">
      <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-black/40 border border-border/50">
        {url ? (
          <>
            <img src={url} alt={`main ${label}`} className="absolute inset-0 w-full h-full object-cover" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
              {observations.map((o, i) => o.coordinates?.length >= 2 && (
                <polyline
                  key={i}
                  points={o.coordinates.map((c) => `${c.x * 100},${c.y * 100}`).join(" ")}
                  fill="none"
                  stroke="hsl(43 58% 62%)"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"><Hand size={18} className="text-muted-foreground" /></div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-1">{label}</p>
    </div>
  );
}