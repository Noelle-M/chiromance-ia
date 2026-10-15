import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const PACKAGE = 'solutions.mynova.chiromancia';
const REPORT = 'chiromancia_rapport_complet';
const SUB = 'chiromancia_questions_illimitees';

function b64url(data: Uint8Array) {
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function googleAccessToken(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = b64url(enc.encode(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })));
  const pem = serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const bytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + payload)));
  const assertion = header + '.' + payload + '.' + b64url(signature);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error('google_oauth_failed');
  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { purchaseToken, productId, scanId } = await req.json();
    if (typeof purchaseToken !== 'string' || purchaseToken.length < 12 ||
        ![REPORT, SUB].includes(productId)) {
      return Response.json({ error: 'invalid_purchase' }, { status: 400 });
    }
    if (productId === REPORT && !scanId) return Response.json({ error: 'scan_required' }, { status: 400 });
    if (productId === REPORT) {
      const scan = await base44.entities.Scan.get(scanId);
      if (!scan || scan.created_by_id !== user.id) return Response.json({ error: 'scan_not_owned' }, { status: 403 });
    }
    const prior = await base44.asServiceRole.entities.PlayEntitlement.filter({ purchase_token: purchaseToken });
    const linked = prior.items || [];
    if (linked.some((entry: any) => entry.user_id !== user.id || entry.product_id !== productId ||
      (productId === REPORT && entry.scan_id !== scanId))) {
      return Response.json({ error: 'purchase_already_linked' }, { status: 409 });
    }
    const raw = await secrets.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    if (!raw) return Response.json({ error: 'billing_not_configured' }, { status: 503 });
    const accessToken = await googleAccessToken(JSON.parse(raw));
    const url = productId === SUB
      ? `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`
      : `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/products/${productId}/tokens/${encodeURIComponent(purchaseToken)}`;
    const response = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
    if (!response.ok) return Response.json({ error: 'purchase_not_verified' }, { status: 402 });
    const purchase = await response.json();
    const line = productId === SUB
      ? purchase.lineItems?.find((item: any) => item.productId === SUB)
      : null;
    const expiry = line?.expiryTime || null;
    const active = productId === SUB
      ? Boolean(line && expiry && Date.parse(expiry) > Date.now() &&
          ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(purchase.subscriptionState))
      : purchase.purchaseState === 0 && (purchase.consumptionState === 0 || linked.some((entry: any) => entry.status === 'active'));
    if (!active) return Response.json({ error: 'purchase_not_active' }, { status: 402 });

    const records = linked;
    const record = { user_id: user.id, product_id: productId, purchase_token: purchaseToken,
      scan_id: productId === REPORT ? scanId : '', status: 'active', expires_at: expiry || '',
      last_verified_at: new Date().toISOString() };
    if (records.length) await base44.asServiceRole.entities.PlayEntitlement.update(records[0].id, record);
    else await base44.asServiceRole.entities.PlayEntitlement.create(record);
    if (productId === REPORT) {
      // Consommation après enregistrement du droit : permet de payer un nouveau rapport.
      const consume = purchase.consumptionState === 0 ? await fetch(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/products/${REPORT}/tokens/${encodeURIComponent(purchaseToken)}:consume`,
        { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken } },
      ) : null;
      if (consume && !consume.ok) console.error('Google Play consume pending', consume.status);
      const reports = await base44.asServiceRole.entities.Report.filter({ scan_id: scanId });
      for (const report of (reports.items || [])) {
        if (report.created_by_id === user.id) await base44.asServiceRole.entities.Report.update(report.id, { purchase_status: 'unlocked' });
      }
    }
    return Response.json({ verified: true, productId, scanId: record.scan_id, expiresAt: expiry });
  } catch (error) {
    console.error('verifyPlayPurchase failed', error);
    return Response.json({ error: 'verification_failed' }, { status: 500 });
  }
});