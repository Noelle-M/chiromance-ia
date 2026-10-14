import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const MOTEUR_A_PROMPT = `Tu es le Moteur A d'analyse visuelle d'une application de chiromancie. Tu observes une photographie de paume de main et tu produis des données structurées, sans interprétation symbolique. Tu n'es pas la chiromancienne : tu décris seulement ce qui est visible, avec précision.

COEFFICIENTS DE COORDONNÉES — RÈGLE ABSOLUE.
Chaque point de chaque ligne est donné par deux nombres x et y, TOUS DEUX compris entre 0 et 1 (JAMAIS en pixels) :
- x = 0 → bord gauche de la photo, x = 1 → bord droit.
- y = 0 → bord supérieur de la photo, y = 1 → bord inférieur.
- N'écris JAMAIS de valeur supérieure à 1 ou négative. Calcule chaque coordonnée en divisant la position en pixels par la largeur ou la hauteur TOTALE de l'image correspondante, jamais par la valeur maximale d'une ligne. Si tu ne peux pas localiser précisément une ligne, ne la trace pas.
Exemple correct, un point au centre de la paume : {"x": 0.50, "y": 0.55}.

TRACÉ DES LIGNES — Pour chaque ligne réellement visible, fournis une polyline de 8 à 14 points qui suit fidèlement le parcours réel de la ligne sur la photo, depuis son origine jusqu'à son extrémité. Ces points doivent permettre de redessiner la ligne par-dessus la photographie. Une vraie ligne de main est courbe : ne te contente pas de 3 points ni de segments droits. Rapproche les points dans les courbes et les bifurcations.

LIGNES À IDENTIFIER — Les lignes traditionnelles : ligne de vie, ligne de cœur, ligne de tête, ligne du destin, ligne du Soleil, ligne de Mercure, et lignes secondaires si visibles. N'invente JAMAIS une ligne absente de la photo. Une ligne incertaine → uncertain=true. Une ligne non identifiable n'apparaît pas.

CARACTÉRISTIQUES — Décris uniquement ce qui est visible : courbure et direction, longueur par rapport à la paume, profondeur apparente, netteté, bifurcations, intersections avec d'autres lignes, interruptions, îlots, chaînettes. Sois précis et factuel, jamais générique.

FORME GÉNÉRALE — Indique la forme de la paume et les proportions des doigts si observables.

QUALITÉ — Vérifie la qualité de la photo : présence d'une main, paume visible, éclairage suffisant, netteté, cadrage. Si la photo est inexploitable, mets quality_ok=false et explique dans quality_notes.

Retourne un JSON conforme au schéma demandé. Texte en français.`;

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
    let handDetected = true;

    for (const s of signed) {
      const visionRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: MOTEUR_A_PROMPT + `\n\nMain analysée : main ${s.hand === 'right' ? 'droite' : 'gauche'}.`,
        file_urls: [s.url],
        response_json_schema: visionSchema,
      });

      qualityNotes += (qualityNotes ? ' | ' : '') + (visionRes.quality_notes || '');
      if (s.hand === 'right') {
        palmShape = visionRes.palm_shape || '';
        fingerProportions = visionRes.finger_proportions || '';
        if (visionRes.hand_detected === 'none' || visionRes.hand_detected === 'absente') handDetected = false;
      }
      const lines = Array.isArray(visionRes.lines) ? visionRes.lines : [];
      for (const ln of lines) {
        if (!ln.coordinates || ln.coordinates.length < 2) continue;
        // Les coordonnées sont relatives à l'image entière. Ne jamais les
        // diviser par le maximum d'une ligne : cela déplace les tracés.
        const norm = ln.coordinates.map((c) => ({ x: Number(c.x), y: Number(c.y) }));
        if (!norm.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y) && c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1)) {
          qualityNotes += (qualityNotes ? ' | ' : '') + 'Coordonnées invalides pour ' + (ln.line_label || ln.line_name);
          continue;
        }
        allObservations.push({
          scan_id: scanId,
          hand: s.hand,
          line_name: ln.line_name,
          line_label: ln.line_label || '',
          coordinates: norm,
          characteristics: ln.characteristics || '',
          confidence: ln.confidence ?? 0.5,
          uncertain: !!ln.uncertain,
          manually_corrected: false,
        });
      }
    }

    // Une vraie chiromancienne commence par vérifier que les lignes sont lisibles.
    // Si la photo ne révèle pas clairement les lignes principales, on ne lit pas
    // « le reste » : on demande une nouvelle photo.
    if (!handDetected) {
      await base44.entities.Scan.update(scanId, { status: 'failed', quality_notes: qualityNotes, error_message: 'Aucune main détectée' });
      return Response.json({ error: "Aucune main n'a été détectée sur la photo. Reprenez-la paume face à l'objectif, bien éclairée.", quality_notes: qualityNotes }, { status: 422 });
    }

    const MAJOR_LINES = ['life', 'heart', 'head'];
    const rightObs = allObservations.filter((o) => o.hand === 'right');
    const clearLines = rightObs.filter((o) => !o.uncertain && (o.confidence ?? 0) >= 0.3);
    const missingMajor = MAJOR_LINES.filter((n) => !clearLines.some((o) => o.line_name === n));

    if (missingMajor.length > 0) {
      await base44.entities.Scan.update(scanId, { status: 'failed', quality_notes: qualityNotes, error_message: 'Lignes insuffisamment visibles' });
      return Response.json({ error: "Les lignes de votre main ne sont pas assez nettes pour une lecture digne d'une vraie chiromancienne. Reprenez la photo : paume bien éclairée, face à l'objectif, doigts légèrement écartés, sans ombre marquée.", quality_notes: qualityNotes }, { status: 422 });
    }

    // Save observations
    if (allObservations.length) {
      await base44.entities.Observation.bulkCreate(allObservations);
    }

    // La lecture (interprétation) est désormais générée par GPT-4.1 via la fonction
    // chatPalm, déclenchée depuis la page de lecture lors de la première consultation.
    await base44.entities.Scan.update(scanId, { status: 'analyzed', quality_notes: qualityNotes });

    return Response.json({ ok: true, observations: allObservations.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}