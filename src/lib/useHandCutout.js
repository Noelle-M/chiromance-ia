import { useEffect, useState } from "react";

// The segmentation service must be reachable by the visitor's browser.
// A local Windows server at localhost:8765 cannot serve a public Base44 app.
const SAM2_URL = import.meta.env.VITE_SAM2_API_URL;

export function useHandCutout(photoUrl) {
  const [state, setState] = useState({ url: null, loading: false });
  useEffect(() => {
    if (!photoUrl || !SAM2_URL) {
      setState({ url: null, loading: false });
      return;
    }
    const controller = new AbortController();
    let objectUrl;
    setState({ url: null, loading: true });
    (async () => {
      try {
        const imageResponse = await fetch(photoUrl, { signal: controller.signal });
        if (!imageResponse.ok) throw new Error("Photo inaccessible");
        const form = new FormData();
        form.append("photo", await imageResponse.blob(), "main.jpg");
        const response = await fetch(`${SAM2_URL.replace(/\/$/, "")}/sam2/cutout`, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Détourage indisponible");
        const result = await response.blob();
        if (!result.type.startsWith("image/")) throw new Error("Le service doit retourner une image PNG transparente");
        objectUrl = URL.createObjectURL(result);
        if (!controller.signal.aborted) setState({ url: objectUrl, loading: false });
      } catch {
        if (!controller.signal.aborted) setState({ url: null, loading: false });
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoUrl]);
  return state;
}
