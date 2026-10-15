import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { scanId } = await req.json().catch(() => ({}));
    if (typeof scanId !== 'string' || !scanId) return Response.json({ error: 'scan_required' }, { status: 400 });
    const scan = await base44.entities.Scan.get(scanId);
    if (!scan || scan.created_by_id !== user.id) return Response.json({ error: 'scan_not_owned' }, { status: 403 });
    const rights = await base44.asServiceRole.entities.PlayEntitlement.filter({ user_id: user.id, product_id: 'chiromancia_rapport_complet', scan_id: scanId, status: 'active' });
    if (!(rights.items || []).length) return Response.json({ error: 'purchase_required' }, { status: 402 });
    const page = await base44.asServiceRole.entities.PremiumReading.filter({ scan_id: scanId }, { sort: '-created_date', limit: 1 });
    return Response.json({ content: page.items?.[0]?.content || '' });
  } catch (error) {
    console.error('getPremiumReading failed', error);
    return Response.json({ error: 'premium_unavailable' }, { status: 500 });
  }
});
