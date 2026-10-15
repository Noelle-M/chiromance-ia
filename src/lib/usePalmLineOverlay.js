import { useEffect, useState } from "react";
import * as ort from "onnxruntime-web";
import { PalmLineSegmenter } from "./palmLines";

// Public model weights by Sam Barber (MIT). A self-hosted URL can be supplied
// with VITE_PALM_MODEL_URL once the deployment hosts the ONNX file.
const MODEL_URL = import.meta.env.VITE_PALM_MODEL_URL ||
  "https://raw.githubusercontent.com/samuelwbarber/palm-line-reader/main/models/student_fp16.onnx";
let modelPromise;
function getModel() {
  if (!modelPromise) {
    modelPromise = PalmLineSegmenter.create(ort, {
      modelUrl: MODEL_URL,
      executionProviders: ["wasm"],
    }).catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de lire la photographie"));
    image.src = url;
  });
}

// Thin each segmented region down to its centerline instead of painting
// the full thick model mask. Zhang-Suen thinning preserves line continuity.
function thinClass(mask, classId, size = 512) {
  const pixels = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) pixels[i] = mask[i] === classId ? 1 : 0;
  const neighbors = (i) => [
    pixels[i - size], pixels[i - size + 1], pixels[i + 1],
    pixels[i + size + 1], pixels[i + size], pixels[i + size - 1],
    pixels[i - 1], pixels[i - size - 1],
  ];
  for (let iteration = 0; iteration < 24; iteration++) {
    let removed = 0;
    for (let phase = 0; phase < 2; phase++) {
      const erase = [];
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          const i = y * size + x;
          if (!pixels[i]) continue;
          const p = neighbors(i);
          const count = p.reduce((sum, v) => sum + v, 0);
          if (count < 2 || count > 6) continue;
          let transitions = 0;
          for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) transitions++;
          if (transitions !== 1) continue;
          if (phase === 0 ? (p[0] && p[2] && p[4]) || (p[2] && p[4] && p[6])
            : (p[0] && p[2] && p[6]) || (p[0] && p[4] && p[6])) continue;
          erase.push(i);
        }
      }
      for (const i of erase) pixels[i] = 0;
      removed += erase.length;
    }
    if (!removed) break;
  }
  return pixels;
}

function coloredOverlay(mask) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  // Classes: 1 heart, 2 head, 3 life. Fate is not detected by this model.
  const colors = {
    1: [220, 62, 113],  // rose
    2: [35, 112, 194],  // bleu
    3: [30, 148, 87],   // vert
  };
  for (const [key, color] of Object.entries(colors)) {
    const pixels = thinClass(mask, Number(key), size);
    for (let i = 0; i < pixels.length; i++) {
      if (!pixels[i]) continue;
      const p = i * 4;
      image.data[p] = color[0];
      image.data[p + 1] = color[1];
      image.data[p + 2] = color[2];
      image.data[p + 3] = 240;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

export function usePalmLineOverlay(photoUrl) {
  const [state, setState] = useState({ url: null, loading: false, error: null });
  useEffect(() => {
    if (!photoUrl) {
      setState({ url: null, loading: false, error: null });
      return;
    }
    let active = true;
    setState({ url: null, loading: true, error: null });
    (async () => {
      try {
        const [model, image] = await Promise.all([getModel(), loadImage(photoUrl)]);
        const { mask } = await model.segment(image);
        if (active) setState({ url: coloredOverlay(mask), loading: false, error: null });
      } catch (error) {
        if (active) setState({ url: null, loading: false, error: error.message });
      }
    })();
    return () => { active = false; };
  }, [photoUrl]);
  return state;
}
