import React, { useState } from "react";
import { usePalmLineOverlay } from "@/lib/usePalmLineOverlay";

const LINE_LABELS = {
  life: "Ligne de vie",
  heart: "Ligne de cœur",
  head: "Ligne de tête",
  fate: "Ligne du destin",
  sun: "Ligne du Soleil",
  mercury: "Ligne de Mercure",
  secondary: "Ligne secondaire",
};

const validCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;
  return coordinates.every((point) =>
    Number.isFinite(point?.x) && Number.isFinite(point?.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
  ) && coordinates.some((point, i) =>
    i > 0 && (point.x !== coordinates[0].x || point.y !== coordinates[0].y)
  );
};

export default function PalmCanvas({ photoUrl, observations = [], onSelect }) {
  const [selected, setSelected] = useState(null);
  const { url: goldenOverlay, loading: lineLoading, error: lineError } = usePalmLineOverlay(photoUrl);
  const [showLabels, setShowLabels] = useState(true);
  const [showTraces, setShowTraces] = useState(true);
  const visibleObservations = observations.filter((o) => validCoordinates(o.coordinates) && (!goldenOverlay || !["life", "heart", "head"].includes(o.line_name)));

  const handleSelect = (obs) => {
    setSelected(obs.id);
    onSelect?.(obs);
  };

  return (
    <div className="relative w-full max-w-md mx-auto rounded-2xl overflow-hidden border border-border/60 bg-black/40">
      {photoUrl ? (
        <img src={photoUrl} alt="main" className="w-full block" />
      ) : (
        <div className="aspect-[3/4] flex items-center justify-center text-muted-foreground text-sm">Photo indisponible</div>
      )}
      {photoUrl && showTraces && goldenOverlay && (
        <img src={goldenOverlay} alt="Lignes principales détectées en doré" className="absolute inset-0 w-full h-full pointer-events-none" />
      )}
      {photoUrl && showTraces && <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        {visibleObservations.map((o, i) => {
          const pts = o.coordinates.map((c) => `${(c.x * 100).toFixed(2)},${(c.y * 100).toFixed(2)}`).join(" ");
          const isSel = selected === o.id;
          return (
            <polyline
              key={o.id || i}
              points={pts}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={isSel ? 4.5 : 3.2}
              strokeOpacity={o.uncertain ? 0.75 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer transition-all"
              style={{
                filter: isSel
                  ? "drop-shadow(0 0 2px #000) drop-shadow(0 0 5px hsl(var(--primary)))"
                  : "drop-shadow(0 0 2px #000) drop-shadow(0 0 3px hsl(var(--primary)))",
                animation: `draw-line 1.2s ease-out ${i * 0.25}s both`,
                strokeDasharray: o.uncertain ? "8 5" : 1000,
              }}
              onClick={() => handleSelect(o)}
            />
          );
        })}
      </svg>}

      {photoUrl && showTraces && showLabels &&
        visibleObservations.map((o, i) => {
          if (!o.coordinates?.length) return null;
          const mid = o.coordinates[Math.floor(o.coordinates.length / 2)];
          return (
            <button
              key={`lbl-${o.id || i}`}
              onClick={() => handleSelect(o)}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] font-display tracking-wide whitespace-nowrap text-primary bg-background/70 backdrop-blur px-1.5 py-0.5 rounded-full border border-primary/30"
              style={{ left: `${mid.x * 100}%`, top: `${mid.y * 100}%` }}
            >
              {o.line_label || LINE_LABELS[o.line_name] || o.line_name}
            </button>
          );
        })}

      {photoUrl && (lineLoading || lineError) && (
        <p className="absolute bottom-2 left-2 right-2 rounded bg-background/85 px-2 py-1 text-[10px] text-primary">
          {lineLoading ? "Détection des lignes en cours…" : "Tracé spécialisé indisponible : affichage des observations existantes."}
        </p>
      )}
      {photoUrl && <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
        <button
          onClick={() => setShowTraces((value) => !value)}
          className="text-[10px] text-primary bg-background/85 backdrop-blur px-2 py-1 rounded-full border border-primary/30"
        >
          {showTraces ? "Voir la photo originale" : "Afficher les tracés"}
        </button>
        {showTraces && <button
          onClick={() => setShowLabels((s) => !s)}
          className="text-[10px] text-primary bg-background/70 backdrop-blur px-2 py-1 rounded-full border border-primary/30"
        >
          {showLabels ? "Masquer les noms" : "Afficher les noms"}
        </button>}
      </div>}

      <style>{`@keyframes draw-line { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }`}</style>
    </div>
  );
}