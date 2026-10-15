import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const a = await base44.asServiceRole.entities.Compatibility.filter({ participant_a_id: user.id }, { limit: 50 });
    const b = await base44.asServiceRole.entities.Compatibility.filter({ participant_b_id: user.id }, { limit: 50 });
    const unique = new Map([...(a.items || []), ...(b.items || [])].map(c => [c.id, c]));
    const entries = [...unique.values()].map(c => ({ id: c.id, status: c.status, created_date: c.created_date, invitation_code: c.participant_a_id === user.id ? c.invitation_code : undefined, result_content: c.status === 'completed' ? c.result_content : '' }));
    return Response.json({ entries });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'list_unavailable' }, { status: 500 });
  }
});
