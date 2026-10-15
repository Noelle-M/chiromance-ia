/**
 * Chiromancia - pont Android Google Play Billing.
 * Même contrat de callbacks que NOVA Tracker; aucun achat simulé sur le web.
 * La validation serveur du jeton Google Play reste obligatoire avant accès.
 */
export const PLAY_PRODUCTS = Object.freeze({
  report: "chiromancia_rapport_complet",
  questions: "chiromancia_questions_illimitees",
});

const pending = new Map();
let installed = false;

function installResolver() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.__chiromanciaBillingResolve = (id, payload) => {
    const callback = pending.get(id);
    if (!callback) return;
    pending.delete(id);
    try { callback(JSON.parse(payload)); }
    catch { callback({ success: false, error: "invalid_native_response" }); }
  };
}

function callNative(method, ...args) {
  if (typeof window === "undefined") return Promise.resolve({ available: false });
  const bridge = window.ChiromanciaBillingNative;
  if (!bridge || typeof bridge[method] !== "function") return Promise.resolve({ available: false });
  installResolver();
  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    try { bridge[method](...args, id); }
    catch (error) {
      pending.delete(id);
      resolve({ available: true, success: false, error: String(error) });
    }
  });
}

export function isBillingAvailable() {
  return typeof window !== "undefined" && !!window.ChiromanciaBillingNative;
}

export function buyReport() {
  return callNative("launchOneTimePurchase", PLAY_PRODUCTS.report);
}

export function subscribeQuestions() {
  return callNative("launchSubscriptionFlow", PLAY_PRODUCTS.questions);
}

export function restorePurchases() {
  return callNative("restorePurchases");
}
