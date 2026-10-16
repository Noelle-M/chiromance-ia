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
    const subscriptions = await base44.asServiceRole.entities.PlayEntitlement.filter({ user_id: user.id, product_id: 'chiromancia_questions_illimitees', status: 'active' });
    const reports = await base44.asServiceRole.entities.PlayEntitlement.filter({ user_id: user.id, product_id: 'chiromancia_rapport_complet', scan_id: scanId, status: 'active' });
    return Response.json({ questionsSubscribed: user.role === 'admin' || (subscriptions.items || []).some((item) => item.expires_at && Date.parse(item.expires_at) > Date.now()), reportEntitled: (reports.items || []).length > 0 });
  } catch (error) {
    console.error('getMyPlayRights failed', error);
    return Response.json({ error: 'rights_unavailable' }, { status: 500 });
  }
});
