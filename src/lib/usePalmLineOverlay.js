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

function goldOverlay(mask) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(512, 512);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) continue;
    const p = i * 4;
    image.data[p] = 224;
    image.data[p + 1] = 180;
    image.data[p + 2] = 93;
    image.data[p + 3] = 235;
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
        if (active) setState({ url: goldOverlay(mask), loading: false, error: null });
      } catch (error) {
        if (active) setState({ url: null, loading: false, error: error.message });
      }
    })();
    return () => { active = false; };
  }, [photoUrl]);
  return state;
}
