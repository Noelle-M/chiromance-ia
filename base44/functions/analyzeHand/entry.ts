import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

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
    const apiKey = secrets.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'Moteur visuel indisponible' }, { status: 503 });
    const hands = [{ hand: 'right', uri: scan.right_hand_photo }];
    if (scan.scan_type === 'full') hands.push({ hand: 'left', uri: scan.left_hand_photo });
    const observations = [];
    for (const { hand, uri } of hands) {
      const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 600 });
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4.1',
          temperature: 0,
          max_tokens: 1800,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'Analyse visuellement cette photographie de paume. Retourne uniquement un objet JSON avec "quality_ok" (booléen), "quality_notes" (texte court en français) et "lines" (tableau). Pour chaque ligne clairement visible: "line_name" parmi life, heart, head, fate, sun, mercury, secondary; "line_label" en français; "characteristics" description concrète de la forme, position, courbure, bifurcations ou interruptions réellement visibles (minimum 12 caractères); "confidence" entre 0 et 1; "uncertain" booléen; "coordinates" tableau de points {x,y} normalisés entre 0 et 1 décrivant approximativement le trajet sur la photo, au moins deux points uniquement si le tracé est localisable. Ne déduis ni personnalité ni avenir. Ne fabrique pas de ligne ou de coordonnées. Si photo floue, paume incomplète, reflets ou lignes non discernables, quality_ok=false et explique pourquoi. Les lignes de vie, tête et coeur sont à chercher séparément. Ne prétends jamais qu une ligne est absente si elle est simplement invisible.' },
            { type: 'image_url', image_url: { url: signed.signed_url, detail: 'high' } }
          ] }]
        }),
        signal: AbortSignal.timeout(90000)
      });
      if (!response.ok) throw new Error('Analyse visuelle indisponible');
      const payload = await response.json();
      const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
      const valid = (parsed.lines || []).filter(o =>
        ['life','heart','head','fate','sun','mercury','secondary'].includes(o.line_name) &&
        typeof o.characteristics === 'string' && o.characteristics.trim().length >= 12 &&
        Number(o.confidence) >= 0.4 && !o.uncertain
      );
      if (parsed.quality_ok === false) {
        const reason = parsed.quality_notes || 'Lignes insuffisamment visibles. Reprenez la photo avec une lumière uniforme.';
        await base44.entities.Scan.update(scanId, { status: 'failed', quality_notes: reason });
        return Response.json({ error: reason }, { status: 422 });
      }
      observations.push(...valid.map(o => ({ scan_id: scanId, hand, line_name: o.line_name, line_label: o.line_label || o.line_name, characteristics: o.characteristics, confidence: o.confidence, uncertain: false, coordinates: Array.isArray(o.coordinates) ? o.coordinates : [] })));
    }
    for (const observation of observations) await base44.asServiceRole.entities.Observation.create(observation);
    await base44.entities.Scan.update(scanId, { status: 'analyzed', quality_notes: '' });
    return Response.json({ ok: true, observations_count: observations.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
