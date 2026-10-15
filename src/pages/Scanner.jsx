import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CameraCapture from "@/components/CameraCapture";

const PARCOURS = [
  { id: 'full', title: 'Lecture complète', desc: 'Main droite puis main gauche', hands: ['right', 'left'] },
  { id: 'quick', title: 'Lecture rapide', desc: 'Main droite uniquement', hands: ['right'] },
  { id: 'compatibility', title: 'Compatibilité amoureuse', desc: 'Main droite uniquement', hands: ['right'] },
];

export default function Scanner() {
  const navigate = useNavigate();
  const [parcours, setParcours] = useState(null);
  const [step, setStep] = useState(0); // index in hands
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const urisRef = useRef({});

  const start = (p) => { setParcours(p); setStep(0); setError(""); urisRef.current = {}; };

  const handleValidated = async (blob) => {
    setUploading(true);
    setError("");
    try {
      const file = new File([blob], `palm-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      urisRef.current[parcours.hands[step]] = file_uri;
      setUploading(false);

      if (step + 1 < parcours.hands.length) {
        setStep(step + 1);
      } else {
        await runAnalysis();
      }
    } catch (e) {
      setUploading(false);
      setError("Échec de l'enregistrement de la photo. Réessayez.");
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError("");
    try {
      const scan = await base44.entities.Scan.create({
        scan_type: parcours.id,
        status: 'pending',
        right_hand_photo: urisRef.current.right,
        left_hand_photo: urisRef.current.left || undefined,
      });
      const res = await base44.functions.invoke('analyzeHand', { scan_id: scan.id }).catch((err) => {
        const msg = err?.response?.data?.error || err?.message;
        throw new Error(msg || "L'analyse a échoué.");
      });
      if (res?.data?.error) throw new Error(res.data.error);
      navigate(parcours.id === 'compatibility' ? `/compatibilite?scan=${encodeURIComponent(scan.id)}` : `/lecture/${scan.id}`);
    } catch (e) {
      setAnalyzing(false);
      setError(e.message || "L'analyse a échoué. Vous pouvez reprendre la photo.");
    }
  };

  if (analyzing) {
    return (
      <div className="px-6 pt-20 pb-10 max-w-md mx-auto text-center">
        <Loader2 className="animate-spin text-primary mx-auto mb-6" size={40} />
        <h2 className="font-display text-2xl text-primary mb-2">Analyse des murmures…</h2>
        <p className="text-sm text-muted-foreground">L'IA observe vos lignes et compose votre lecture. Vous pouvez patienter, votre analyse est sauvegardée.</p>
      </div>
    );
  }

  if (!parcours) {
    return (
      <div className="px-6 pt-12 pb-6 max-w-md mx-auto">
        <h1 className="font-display text-3xl mb-2">Scanner vos mains</h1>
        <p className="text-sm text-muted-foreground mb-6">Choisissez votre parcours.</p>
        <div className="space-y-3">
          {PARCOURS.map((p) => (
            <button key={p.id} onClick={() => start(p)} className="glass-card w-full text-left p-4 flex items-center justify-between hover:border-primary/40 transition-colors">
              <div>
                <p className="font-display text-lg">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const currentHand = parcours.hands[step];
  return (
    <div className="px-6 pt-10 pb-6 max-w-md mx-auto">
      <button onClick={() => (step === 0 ? setParcours(null) : setStep(step - 1))} className="mb-4 text-sm text-muted-foreground flex items-center gap-1">
        <ArrowLeft size={16} /> Retour
      </button>
      <h2 className="font-display text-2xl mb-1 text-center">
        {currentHand === 'right' ? 'Votre main droite' : 'Votre main gauche'}
      </h2>
      <p className="text-xs text-muted-foreground text-center mb-6">
        Étape {step + 1} sur {parcours.hands.length}
      </p>

      {uploading && (
        <div className="flex items-center justify-center gap-2 text-sm text-primary mb-4">
          <Loader2 className="animate-spin" size={16} /> Enregistrement de la photo…
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <CameraCapture
        key={`${parcours.id}-${currentHand}`}
        handLabel={currentHand === 'right' ? 'Main droite — paume vers le haut' : 'Main gauche — paume vers le haut'}
        onValidated={handleValidated}
      />
    </div>
  );
}