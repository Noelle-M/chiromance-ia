import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const MOTEUR_A_PROMPT = `Tu es le Moteur A d'analyse visuelle d'une application de chiromancie. Tu observes une photographie de paume de main et tu produis des données structurées, sans interprétation symbolique.

Ta mission :
- Identifier UNIQUEMENT les lignes réellement visibles sur la photographie. Les lignes traditionnelles : ligne de vie, ligne de cœur, ligne de tête, ligne du destin, ligne du Soleil, ligne de Mercure, et lignes secondaires si visibles.
- Ne JAMAIS inventer une ligne absente de la photo. Une ligne incertaine doit être marquée uncertain=true. Une ligne non identifiable ne doit pas apparaître.
- Pour chaque ligne visible, fournir un tracé sous forme de polyline de coordonnées normalisées (x et y entre 0 et 1, origine en haut à gauche, x horizontal, y vertical) suivant le parcours réel de la ligne sur la photo. Les points doivent permettre de redessiner la ligne sur la photographie.
- Décrire les caractéristiques visuelles observées : courbure, longueur relative, profondeur apparente, bifurcations, intersections, interruptions, forme générale.
- Indiquer la forme générale de la paume et les proportions des doigts si observables.
- Vérifier la qualité de la photo : présence d'une main, paume visible, éclairage suffisant, netteté, cadrage. Si la photo est inexploitable, mettre quality_ok=false et expliquer dans quality_notes.

Retourne un JSON conforme au schéma demandé. Texte en français.`;

const MOTEUR_B_PROMPT = `Tu es le Moteur B d'interprétation d'une application de chiromancie. Tu adopts le style narratif d'une chiromancienne expérimentée, connissant les différentes traditions (classique, indienne, chinoise). Tu produis une lecture personnalisée à partir EXCLUSIVEMENT des observations visuelles fournies par le Moteur A.

Règles impératives :
- Chaque affirmation doit s'appuyer sur une caractéristique réellement observée (courbure, longueur, bifurcation, interruption, forme, etc.) et indiquer le lien avec son interprétation traditionnelle documentée.
- Interdit : textes vagues et interchangeables (effet Barnum), affirmations universelles du type "vous êtes sensible mais fort quand il faut".
- Interdit : inventer des événements passés, maladies, décès, grossesses, dates futures. Ne pas prétendre déduire scientifiquement la personnalité ou l'avenir.
- Présenter la chiromancie comme une tradition symbolique et culturelle.
- Deux observations différentes doivent pouvoir produire des lectures différentes.
- Style : prose naturelle, paragraphes développés, transitions fluides, ton chaleureux et raffiné, en français.

Tu génères deux contenus en markdown :
- free_content : une lecture gratuite développée (introduction personnalisée, interprétation des principales lignes observées, particularités observées, première lecture symbolique, et comparaison introductive des deux mains si deux mains ont été analysées). Suffisamment développée pour offrir une vraie expérience.
- full_content : le rapport complet approfondi structuré en sections markdown (## ...) couvrant : introduction, analyse détaillée de chaque ligne observée, analyse des monts observables, particularités/intersections/bifurcations, comparaison des deux mains si disponibles, interprétation symbolique de la vie affective, interprétation symbolique des aspirations personnelles, synthèse personnalisée. Paragraphes développés, sans répétitions automatiques.
- summary : un résumé d'une à deux phrases.

Retourne un JSON conforme au schéma demandé.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scanId = body.scan_id;
    if (!scanId) return Response.json({ error: 'scan_id requis' }, { status: 400 });

    const scan = await base44.entities.Scan.get(scanId);
    if (!scan) return Response.json({ error: 'Scan introuvable' }, { status: 404 });

    await base44.entities.Scan.update(scanId, { status: 'analyzing', error_message: '' });

    const hands = [{ hand: 'right', uri: scan.right_hand_photo }];
    if (scan.scan_type === 'full' && scan.left_hand_photo) {
      hands.push({ hand: 'left', uri: scan.left_hand_photo });
    }

    // Signed URLs for the vision model
    const signed = [];
    for (const h of hands) {
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri: h.uri, expires_in: 600,
      });
      signed.push({ hand: h.hand, url: signed_url });
    }

    const visionSchema = {
      type: 'object',
      properties: {
        quality_ok: { type: 'boolean' },
        quality_notes: { type: 'string' },
        hand_detected: { type: 'string' },
        palm_shape: { type: 'string' },
        finger_proportions: { type: 'string' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              line_name: { type: 'string', enum: ['life', 'heart', 'head', 'fate', 'sun', 'mercury', 'secondary'] },
              line_label: { type: 'string' },
              coordinates: {
                type: 'array',
                items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
              },
              characteristics: { type: 'string' },
              confidence: { type: 'number' },
              uncertain: { type: 'boolean' },
            },
            required: ['line_name', 'coordinates', 'confidence'],
          },
        },
      },
      required: ['quality_ok', 'lines'],
    };

    const allObservations = [];
    let qualityNotes = '';
    let palmShape = '';
    let fingerProportions = '';
    let firstQualityOk = true;

    for (const s of signed) {
      const visionRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: MOTEUR_A_PROMPT + `\n\nMain analysée : main ${s.hand === 'right' ? 'droite' : 'gauche'}.`,
        file_urls: [s.url],
        response_json_schema: visionSchema,
      });

      if (!visionRes.quality_ok) firstQualityOk = false;
      qualityNotes += (qualityNotes ? ' | ' : '') + (visionRes.quality_notes || '');
      if (s.hand === 'right') {
        palmShape = visionRes.palm_shape || '';
        fingerProportions = visionRes.finger_proportions || '';
      }
      const lines = visionRes.lines || [];
      for (const ln of lines) {
        if (!ln.coordinates || ln.coordinates.length < 2) continue;
        allObservations.push({
          scan_id: scanId,
          hand: s.hand,
          line_name: ln.line_name,
          line_label: ln.line_label || '',
          coordinates: ln.coordinates.map((c) => ({ x: c.x, y: c.y })),
          characteristics: ln.characteristics || '',
          confidence: ln.confidence ?? 0.5,
          uncertain: !!ln.uncertain,
          manually_corrected: false,
        });
      }
    }

    if (!firstQualityOk) {
      await base44.entities.Scan.update(scanId, { status: 'failed', quality_notes: qualityNotes, error_message: 'Photo inexploitable' });
      return Response.json({ error: 'Photo inexploitable', quality_notes: qualityNotes }, { status: 422 });
    }

    // Save observations
    if (allObservations.length) {
      await base44.entities.Observation.bulkCreate(allObservations);
    }

    // Moteur B: interpretation
    const obsSummary = allObservations.map((o) =>
      `- Main ${o.hand === 'right' ? 'droite' : 'gauche'} — ${o.line_label || o.line_name} (confiance ${(o.confidence * 100).toFixed(0)}%${o.uncertain ? ', incertain' : ''}) : ${o.characteristics}`
    ).join('\n');
    const handsDesc = hands.map((h) => (h.hand === 'right' ? 'main droite' : 'main gauche')).join(' et ');

    const interpSchema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        free_content: { type: 'string' },
        full_content: { type: 'string' },
      },
      required: ['free_content', 'full_content'],
    };

    const interpRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${MOTEUR_B_PROMPT}\n\nContexte : analyse de ${handsDesc}.\nForme de la paume : ${palmShape || 'non déterminée'}.\nProportions des doigts : ${fingerProportions || 'non déterminées'}.\n\nObservations visuelles du Moteur A :\n${obsSummary || 'Aucune ligne majeure clairement identifiable ; baser la lecture sur la forme de la paume et les proportions observées.'}`,
      response_json_schema: interpSchema,
    });

    await base44.entities.Reading.create({
      scan_id: scanId,
      free_content: interpRes.free_content,
      full_content: interpRes.full_content,
      summary: interpRes.summary || '',
      version: '1',
    });

    await base44.entities.Scan.update(scanId, { status: 'analyzed', quality_notes: qualityNotes });

    return Response.json({ ok: true, observations: allObservations.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}