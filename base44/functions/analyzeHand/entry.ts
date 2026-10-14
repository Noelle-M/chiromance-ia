import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// The dedicated ONNX model is used only for the decorative golden overlay.
// GPT-4.1 examines the ORIGINAL photo directly in chatPalm.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { scan_id: scanId } = await req.json().catch(() => ({}));
    if (!scanId) return Response.json({ error: 'scan_id requis' }, { status: 400 });
    const scan = await base44.entities.Scan.get(scanId);
    if (!scan) return Response.json({ error: 'Scan introuvable' }, { status: 404 });
    if (!scan.right_hand_photo || (scan.scan_type === 'full' && !scan.left_hand_photo)) {
      await base44.entities.Scan.update(scanId, { status: 'failed', quality_notes: 'Photographie manquante' });
      return Response.json({ error: 'Photographie manquante. Reprenez la photo.' }, { status: 422 });
    }
    // No model A, no fabricated polylines, no stored pseudo-observations.
    await base44.entities.Scan.update(scanId, { status: 'analyzed', quality_notes: '' });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
