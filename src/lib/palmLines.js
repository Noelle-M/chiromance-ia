/* PalmLineSegmenter, MIT, copyright (c) 2026 Sam Barber.
 * Source: https://github.com/samuelwbarber/palm-line-reader
 * See src/lib/PALM_LINE_LICENSE.txt for license text.
 */
/**
 * palmLines.js — client-side palm-crease segmentation (exp2 student model).
 *
 * Framework-agnostic ES module. Wraps onnxruntime-web. No build step required.
 * All preprocessing/postprocessing constants mirror model/model_meta.json —
 * if you change one, change both.
 *
 * Usage:
 *   import * as ort from 'onnxruntime-web';          // or your bundler's path
 *   import { PalmLineSegmenter } from './palmLines.js';
 *
 *   const seg = await PalmLineSegmenter.create(ort, {
 *     modelUrl: '/models/student_fp16.onnx',
 *     // executionProviders default: try webgpu, fall back to wasm
 *   });
 *   const result = await seg.segment(imgElementOrCanvasOrImageBitmap);
 *   // result.mask   -> Uint8Array(512*512) of class indices 0..3
 *   // result.width/height = 512
 *   const rgba = seg.maskToRGBA(result.mask);         // Uint8ClampedArray, ready for ImageData
 *
 * The model input is a FIXED 512x512. Feed it a reasonably square hand/palm
 * crop for best results (the same framing the training crops used); this
 * module just plain-resizes whatever you give it to 512x512, matching training.
 */

export const MODEL_INPUT_SIZE = 512;
export const IMAGENET_MEAN = [0.485, 0.456, 0.406];
export const IMAGENET_STD = [0.229, 0.224, 0.225];

export const CLASSES = [
  { index: 0, name: 'background', color: [0, 0, 0] },
  { index: 1, name: 'heart_line', color: [255, 0, 0] },
  { index: 2, name: 'head_line', color: [0, 0, 255] },
  { index: 3, name: 'life_line', color: [0, 255, 0] },
];
export const NUM_CLASSES = CLASSES.length;

export class PalmLineSegmenter {
  /**
   * @param {object} ort           the onnxruntime-web module (imported by the host app)
   * @param {InferenceSession} session
   * @param {object} opts
   */
  constructor(ort, session, opts = {}) {
    this.ort = ort;
    this.session = session;
    this.inputName = session.inputNames[0];
    this.outputName = session.outputNames[0];
    this.size = opts.size || MODEL_INPUT_SIZE;
    // Reusable offscreen canvas for resize+pixel extraction.
    this._canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(this.size, this.size)
        : Object.assign(document.createElement('canvas'), { width: this.size, height: this.size });
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * @param {object} ort  onnxruntime-web module
   * @param {object} opts  { modelUrl, executionProviders?, sessionOptions? }
   */
  static async create(ort, opts) {
    if (!opts || !opts.modelUrl) throw new Error('PalmLineSegmenter.create: opts.modelUrl is required');
    const sessionOptions = {
      executionProviders: opts.executionProviders || ['webgpu', 'wasm'],
      graphOptimizationLevel: 'all',
      ...(opts.sessionOptions || {}),
    };
    const session = await ort.InferenceSession.create(opts.modelUrl, sessionOptions);
    return new PalmLineSegmenter(ort, session, opts);
  }

  /**
   * Draw the source into the 512x512 canvas and build the normalized NCHW tensor.
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap|HTMLVideoElement} source
   * @returns {Float32Array} length 3*size*size
   */
  preprocess(source) {
    const s = this.size;
    // Plain resize to s x s (no letterbox) — matches training's A.Resize.
    this._ctx.drawImage(source, 0, 0, s, s);
    const { data } = this._ctx.getImageData(0, 0, s, s); // RGBA, row-major, uint8

    const chw = new Float32Array(3 * s * s);
    const plane = s * s;
    for (let i = 0, p = 0; i < plane; i++, p += 4) {
      // RGBA -> normalized R,G,B planes
      chw[i] = (data[p] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
      chw[plane + i] = (data[p + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
      chw[2 * plane + i] = (data[p + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
    }
    return chw;
  }

  /**
   * Run the full pipeline on one image.
   * @returns {Promise<{mask: Uint8Array, width: number, height: number}>}
   *          mask is size*size class indices (0..3), row-major.
   */
  async segment(source) {
    const s = this.size;
    const chw = this.preprocess(source);
    const input = new this.ort.Tensor('float32', chw, [1, 3, s, s]);
    const out = await this.session.run({ [this.inputName]: input });
    const logits = out[this.outputName].data; // Float32Array [1,4,s,s], class-major
    const mask = argmaxCHW(logits, NUM_CLASSES, s * s);
    return { mask, width: s, height: s };
  }

  /**
   * Colorize a class-index mask into RGBA pixels (background transparent),
   * suitable for `new ImageData(rgba, size, size)` and drawing as an overlay.
   * @param {Uint8Array} mask
   * @param {number} alpha  overlay opacity for foreground classes (0..255), default 255
   * @returns {Uint8ClampedArray}
   */
  maskToRGBA(mask, alpha = 255) {
    const rgba = new Uint8ClampedArray(mask.length * 4);
    for (let i = 0; i < mask.length; i++) {
      const c = mask[i];
      if (c === 0) continue; // background stays transparent
      const [r, g, b] = CLASSES[c].color;
      const o = i * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = alpha;
    }
    return rgba;
  }
}

/** Per-pixel argmax over a class-major [C, HW] logits buffer. */
export function argmaxCHW(logits, numClasses, hw) {
  const mask = new Uint8Array(hw);
  for (let i = 0; i < hw; i++) {
    let best = 0;
    let bestVal = logits[i];
    for (let c = 1; c < numClasses; c++) {
      const v = logits[c * hw + i];
      if (v > bestVal) {
        bestVal = v;
        best = c;
      }
    }
    mask[i] = best;
  }
  return mask;
}
