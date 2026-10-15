import { Capacitor, registerPlugin } from "@capacitor/core";

export const PLAY_PRODUCTS = Object.freeze({
  report: "chiromancia_rapport_complet",
  questions: "chiromancia_questions_illimitees",
});

const Billing = registerPlugin("ChiromanciaBilling");

export function isBillingAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

async function purchase(productId, type) {
  if (!isBillingAvailable()) return { available: false };
  try {
    const result = await Billing.purchase({ productId, type });
    // Le jeton doit être validé côté serveur avant de donner un droit.
    return { available: true, ...result, verified: false };
  } catch (error) {
    return { available: true, success: false, error: error?.message || String(error) };
  }
}

export async function acknowledgeVerifiedPurchase(purchaseToken) {
  if (!isBillingAvailable() || !purchaseToken) return false;
  try {
    const result = await Billing.acknowledgePurchase({ purchaseToken });
    return result.acknowledged === true;
  } catch (error) {
    console.warn('Google Play acknowledgement pending', error);
    return false;
  }
}

export function buyReport() {
  return purchase(PLAY_PRODUCTS.report, "inapp");
}

export function subscribeQuestions() {
  return purchase(PLAY_PRODUCTS.questions, "subs");
}

export async function restorePurchases() {
  if (!isBillingAvailable()) return { available: false };
  try {
    return { available: true, ...(await Billing.restorePurchases()), verified: false };
  } catch (error) {
    return { available: true, success: false, error: error?.message || String(error) };
  }
}
