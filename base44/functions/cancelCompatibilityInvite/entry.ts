import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const { compatibilityId } = await req.json().catch(() => ({}));
    if (typeof compatibilityId !== 'string') return Response.json({ error: 'invalid_request' }, { status: 400 });
    const c = await api.asServiceRole.entities.Compatibility.get(compatibilityId);
    if (!c || c.participant_a_id !== user.id) return Response.json({ error: 'forbidden' }, { status: 403 });
    if (c.status !== 'pending') return Response.json({ error: 'cannot_cancel' }, { status: 409 });
    await api.asServiceRole.entities.Compatibility.update(c.id, { status: 'cancelled' });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'cancel_failed' }, { status: 500 });
  }
}
