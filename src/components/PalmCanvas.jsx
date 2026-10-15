import React, { useState } from "react";
import { usePalmLineOverlay } from "@/lib/usePalmLineOverlay";
import { useHandCutout } from "@/lib/useHandCutout";

// Only the specialized ONNX model draws lines. No legacy GPT coordinates,
// SVG polylines, labels or fallback to the previous drawing engine.
export default function PalmCanvas({ photoUrl }) {
  const [showTraces, setShowTraces] = useState(true);
  const { url: coloredOverlay, loading, error } = usePalmLineOverlay(photoUrl);
  const { url: cutoutUrl } = useHandCutout(photoUrl);

  return (
    <div className="relative w-full max-w-md mx-auto rounded-2xl overflow-hidden border border-border/60 bg-black/40">
      {photoUrl ? (
        <div className="relative">
          <img src={photoUrl} alt="Paume de la main" className="w-full block" />
          {cutoutUrl && <div className="absolute inset-0" style={{ backgroundImage: 'url("/Velours%20bleu%20nuit%20aux%20plis%20soyeux.png")', backgroundSize: "cover", backgroundPosition: "center" }}>
            <img src={cutoutUrl} alt="Main détourée sur velours bleu nuit" className="w-full h-full object-fill" />
          </div>}
        </div>
      ) : (
        <div className="aspect-[3/4] flex items-center justify-center text-muted-foreground text-sm">Photo indisponible</div>
      )}
      {photoUrl && showTraces && coloredOverlay && (
        <img src={coloredOverlay} alt="Ligne de cœur rose, ligne de tête bleue et ligne de vie verte" className="absolute inset-0 w-full h-full pointer-events-none" />
      )}
      {photoUrl && showTraces && (loading || error) && (
        <p className="absolute bottom-2 left-2 right-2 rounded bg-background/85 px-2 py-1 text-[10px] text-primary">
          {loading ? "Détection des lignes en cours…" : "Détection spécialisée indisponible. Aucun tracé affiché."}
        </p>
      )}
      {photoUrl && (
        <div className="absolute top-2 right-2">
          <button
            onClick={() => setShowTraces((value) => !value)}
            className="text-[10px] text-primary bg-background/85 backdrop-blur px-2 py-1 rounded-full border border-primary/30"
          >
            {showTraces ? "Voir la photo originale" : "Afficher les lignes"}
          </button>
        </div>
      )}
    </div>
  );
}
