import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const { compatibilityId } = await req.json();
    if (typeof compatibilityId !== 'string' || !compatibilityId.trim()) return Response.json({ error: 'invalid_id' }, { status: 400 });
    const compatibility = await api.asServiceRole.entities.Compatibility.get(compatibilityId).catch(() => null);
    if (!compatibility) return Response.json({ error: 'not_found' }, { status: 404 });
    const field = compatibility.participant_a_id === user.id ? 'hidden_by_a' :
      compatibility.participant_b_id === user.id ? 'hidden_by_b' : null;
    if (!field) return Response.json({ error: 'forbidden' }, { status: 403 });
    if (!compatibility[field]) {
      await api.asServiceRole.entities.Compatibility.update(compatibilityId, { [field]: true });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'hide_failed' }, { status: 500 });
  }
}
