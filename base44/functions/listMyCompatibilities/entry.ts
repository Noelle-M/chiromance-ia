import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const a = await base44.asServiceRole.entities.Compatibility.filter({ participant_a_id: user.id }, { limit: 50 });
    const b = await base44.asServiceRole.entities.Compatibility.filter({ participant_b_id: user.id }, { limit: 50 });
    const unique = new Map([...(a.items || []), ...(b.items || [])].filter(c => !(c.participant_a_id === user.id ? c.hidden_by_a : c.hidden_by_b)).map(c => [c.id, c]));
    const entries = [...unique.values()].sort((x, y) => new Date(y.created_date || 0) - new Date(x.created_date || 0)).map(c => ({ id: c.id, status: c.status, created_date: c.created_date, is_initiator: c.participant_a_id === user.id, scan_a_id: c.participant_a_id === user.id ? c.scan_a_id : undefined, scan_b_id: c.participant_b_id === user.id ? c.scan_b_id : undefined, invitation_code: c.participant_a_id === user.id ? c.invitation_code : undefined, result_content: c.status === 'completed' ? c.result_content : '' }));
    const pending = entries.filter(c => c.status === 'pending');
    for (const entry of pending) {
      const original = unique.get(entry.id);
      const scan = original?.scan_a_id ? await base44.asServiceRole.entities.Scan.get(original.scan_a_id).catch(() => null) : null;
      if (!scan || scan.created_by_id !== original.participant_a_id || scan.status !== 'analyzed') {
        await base44.asServiceRole.entities.Compatibility.update(entry.id, { status: 'cancelled' });
        entry.status = 'cancelled';
      }
    }
    for (const entry of entries) {
      if (entry.status === 'cancelled') continue;
      const original = unique.get(entry.id);
      for (const [key, scanId] of [['photo_a_url', original.scan_a_id], ['photo_b_url', original.scan_b_id]]) {
        if (!scanId) continue;
        try {
          const scan = await base44.asServiceRole.entities.Scan.get(scanId);
          if (scan?.right_hand_photo) {
            const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: scan.right_hand_photo, expires_in: 600 });
            entry[key] = signed.signed_url;
          }
        } catch (error) { console.error('Compatibility thumbnail unavailable', entry.id, key); }
      }
    }
    return Response.json({ entries });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'list_unavailable' }, { status: 500 });
  }
}