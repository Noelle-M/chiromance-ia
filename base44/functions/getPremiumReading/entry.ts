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
    let content = page.items?.[0]?.content || '';
    // Migrer les rapports historiques après vérification du droit d'achat.
    const readings = await base44.asServiceRole.entities.Reading.filter({ scan_id: scanId }, { sort: '-created_date', limit: 1 });
    const legacy = readings.items?.[0];
    if (legacy?.full_content) {
      if (!content) {
        content = legacy.full_content;
        await base44.asServiceRole.entities.PremiumReading.create({ scan_id: scanId, content });
      }
      await base44.asServiceRole.entities.Reading.update(legacy.id, { full_content: '' });
    }
    const messages = await base44.asServiceRole.entities.ChatMessage.filter({ scan_id: scanId, kind: 'deep' });
    const oldDeep = (messages.items || []).filter((message) => message.role === 'assistant' && message.content);
    if (!content && oldDeep.length) {
      content = oldDeep[oldDeep.length - 1].content;
      await base44.asServiceRole.entities.PremiumReading.create({ scan_id: scanId, content });
    }
    if (content) {
      for (const message of (messages.items || [])) {
        await base44.asServiceRole.entities.ChatMessage.delete(message.id);
      }
    }
    return Response.json({ content });
  } catch (error) {
    console.error('getPremiumReading failed', error);
    return Response.json({ error: 'premium_unavailable' }, { status: 500 });
  }
});
