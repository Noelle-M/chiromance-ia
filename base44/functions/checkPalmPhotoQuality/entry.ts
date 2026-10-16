import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'Connexion requise' }, { status: 401 });
    const { file_uri: uri, hand } = await req.json().catch(() => ({}));
    if (typeof uri !== 'string' || !uri || !['right', 'left'].includes(hand)) return Response.json({ error: 'Photographie invalide' }, { status: 400 });
    const key = await secrets.get('OPENAI_API_KEY');
    if (!key) return Response.json({ error: 'Contrôle photo indisponible' }, { status: 503 });
    const signed = await api.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 300 });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1', temperature: 0, max_tokens: 220,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [
          { type: 'text', text: `Contrôle qualité d'une photo destinée à la lecture de la paume ${hand === 'right' ? 'droite' : 'gauche'}. Réponds uniquement en JSON {"acceptable":boolean,"reason":string}. Accepte les photos ordinaires de téléphone si la paume est reconnaissable, suffisamment nette et éclairée pour observer les principaux plis. Refuse UNIQUEMENT les défauts évidents qui empêchent réellement la lecture : mauvaise main ou dos de main, paume coupée, flou important, obscurité ou surexposition sévère, paume cachée. N'exige pas de fond neutre, de lignes secondaires ni de coordonnées. Une paume avec des plis peu marqués peut être une bonne photo. Si refus, reason explique le défaut visible et comment reprendre la photo en une phrase en français. Si acceptée, reason vide.` },
          { type: 'image_url', image_url: { url: signed.signed_url, detail: 'high' } }
        ] }]
      }), signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) throw new Error('Contrôle photo temporairement indisponible');
    const data = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    if (typeof result.acceptable !== 'boolean') throw new Error('Contrôle photo incomplet');
    return Response.json({ acceptable: result.acceptable, reason: result.acceptable ? '' : (result.reason || 'La paume est difficile à distinguer. Reprenez la photo.') });
  } catch (error) {
    console.error('checkPalmPhotoQuality', error);
    return Response.json({ error: 'Le contrôle de la photo a échoué. Réessayez.' }, { status: 503 });
  }
}
