import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== 'SUPPRIMER') return Response.json({ error: 'confirmation_required' }, { status: 400 });
    const service = api.asServiceRole;
    const scans = await service.entities.Scan.filter({ created_by_id: user.id }, { limit: 1000 });
    const scanIds = new Set((scans.items || []).map(s => s.id));
    const compatA = await service.entities.Compatibility.filter({ participant_a_id: user.id }, { limit: 1000 });
    const compatB = await service.entities.Compatibility.filter({ participant_b_id: user.id }, { limit: 1000 });
    const compatibilities = [...new Map([...(compatA.items || []), ...(compatB.items || [])].map(c => [c.id, c])).values()];
    // Remove shared readings entirely so no other participant retains this user's palm analysis.
    for (const c of compatibilities) await service.entities.Compatibility.delete(c.id);
    for (const id of scanIds) {
      for (const entity of ['Observation', 'ChatMessage', 'Reading', 'Report']) {
        const matches = await service.entities[entity].filter({ scan_id: id }, { limit: 1000 });
        for (const item of (matches.items || [])) await service.entities[entity].delete(item.id);
      }
      await service.entities.Scan.delete(id);
    }
    const rights = await service.entities.PlayEntitlement.filter({ user_id: user.id }, { limit: 1000 });
    for (const item of (rights.items || [])) await service.entities.PlayEntitlement.delete(item.id);
    // Delete the actual authentication identity, not just its session.
    await service.entities.User.delete(user.id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('deleteMyAccount failed', error);
    return Response.json({ error: 'account_deletion_failed', message: 'Suppression incomplète. Contactez le support pour finaliser la suppression.' }, { status: 500 });
  }
}
