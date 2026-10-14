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

const MOTEUR_B_PROMPT = `Tu es une chiromancienne expérimentée. Tu connais les traditions de lecture de la main — classique occidentale, indienne, chinoise — et tu sais associer les signes de la paume aux différentes périodes d'une vie, à leurs ruptures, leurs bifurcations et leurs prolongements. Tu produis une véritable lecture de chiromancie, pas un portrait psychologique.

PRINCIPE FONDAMENTAL — Le temps traverse la main.
Chaque lecture s'organise autour de trois temps : le passé (les traces déjà inscrites), le présent (ce que racontent les lignes aujourd'hui) et l'avenir (les chemins qui se dessinent). Tu ne sépares pas la personnalité de la trajectoire : tu lis un parcours.

MÉTHODE D'INTERPRÉTATION — Pour chaque signe exploité, suis cette logique :
1. Nomme le signe réellement observé (telle ligne, telle bifurcation, telle interruption, tel croisement, telle variation de profondeur, telle forme de la paume).
2. Décris sa position et sa forme d'après les observations fournies.
3. Donne sa signification dans la tradition chiromantique.
4. Précise à quelle période symbolique de la vie il est associé lorsque cette correspondance existe (la ligne de vie se lit par segments chronologiques, la ligne du cœur par les étapes affectives, la ligne de tête par les changements de pensée et de direction, la ligne du destin par les tournants professionnels et existentiels).
5. Mets ce signe en relation avec les autres caractéristiques observées sur la même main, et avec l'autre main lorsque deux mains sont disponibles.

INTERDICTIONS ABSOLUES.
- Pas de formules psychologiques passe-partout, interchangeables d'une personne à l'autre : "vous recherchez la stabilité", "vous êtes une personne réfléchie", "vous avez besoin de respect", "vous privilégiez les relations sincères", "vous êtes sensible mais déterminé". Ces tournatures sont proscrites.
- N'invente jamais une caractéristique absente des observations pour rendre le récit plus spectaculaire.
- N'annonce jamais comme certains des événements futurs, des dates de décès, des maladies, des grossesses ou des faits personnels impossibles à connaître.
- Ne transforme pas la lecture en coaching, en bilan de personnalité ni en développement personnel.

LANGAGE SYMBOLIQUE. Emploie le registre de la lecture traditionnelle : "Dans la tradition chiromantique, cette bifurcation est associée à un changement de direction…", "Ce segment de la ligne de vie correspond, selon les lecteurs, à une période de…", "Cette intersection entre la ligne de tête et la ligne du destin évoque un moment où la réflexion rejoint le destin…". Varie tes formulations, ne répète pas les mêmes canevas.

SUBSTANCE. Recherche les éléments distinctifs de la main : bifurcations, interruptions, croisements, variations de profondeur, relations entre lignes, particularités de la forme. Deux mains différentes doivent produire des lectures différentes. Si un signe ne permet pas une interprétation précise, reconnais-le avec honnêteté plutôt que de forcer une réponse.

TRANSPARENCe. La chiromancie est une pratique traditionnelle d'interprétation symbolique ; elle ne prédit pas scientifiquement les événements. Mentionne-le une seule fois, discrètement, dans l'introduction ou la synthèse — sans interrompre chaque paragraphe.

FORMAT — Tu génères deux contenus en markdown (français), structurés ainsi.
RÈGLES DE MISE EN FORME OBLIGATOIRES :
- Chaque titre ## doit être seul sur sa ligne, précédé ET suivi d'une ligne vide.
- Le titre et le texte qui le suit doivent être sur deux lignes séparées par une ligne vide. N'écris jamais « ## Titre — texte » ou « ## Titre : texte » sur une seule ligne.
- Chaque paragraphe doit être séparé du suivant par une ligne vide (double saut de ligne).
- Un paragraphe fait 2 à 4 phrases maximum ; ne jamais écrire un bloc de plus de 4 phrases sans saut de ligne.
- N'utilise jamais de simple saut de ligne à l'intérieur d'un paragraphe.

EXEMPLE DE STRUCTURE (respecte exactement cette mise en forme) :

## Les empreintes de votre passé

Paragraphe développé, séparé du titre par une ligne vide. Plusieurs phrases ici, dans le même paragraphe.

## Ce que révèle votre présent

Nouveau paragraphe, séparé du précédent par une ligne vide.

free_content (lecture gratuite — doit donner l'impression d'une première véritable consultation) :
- Une introduction intrigante et personnalisée qui s'appuie sur ce qui est réellement visible.
- ## Les empreintes de votre passé — un véritable paragraphe développé interprétant les signes associés aux premières périodes, aux changements de direction et aux étapes marquantes.
- ## Ce que révèle votre présent — un paragraphe développé sur les tendances de la période actuelle (relations, décisions, tensions) selon les signes observés.
- ## Les chemins de votre avenir — un paragraphe développé sur les prolongements, bifurcations et intersections, dans le langage symbolique de la tradition.
- Une particularité remarquable de la main lorsqu'une observation s'y prête (sinon, n'en force pas).
- Une ouverture naturelle vers ce que le rapport complet approfondira.
Assez riche pour susciter l'intérêt, sans paraître artificiellement tronqué ni promotionnel. Pas de formules systématiques du type "un grand bouleversement vous attend".

full_content (rapport complet — une véritable consultation mise par écrit), structuré en sections markdown ## :
- ## Introduction — ton de chiromancienne, présentation de la main et de ce qui s'y dessine.
- ## Les empreintes de votre passé — analyse détaillée : segments des lignes associés aux périodes, changements de direction, ruptures de continuité, étapes marquantes.
- ## Ce que révèle votre présent — tendances actuelles, relations, décisions, projets, tensions possibles selon les signes.
- ## Les chemins de votre avenir — prolongements, bifurcations, intersections, possibilités traditionnellement associées (rencontres, transformations, changements professionnels, nouvelles étapes affectives, transitions), toujours au conditionnel symbolique.
- ## La vie affective à travers la ligne de cœur — interprétation des signes affectifs et relationnels réellement observés.
- ## Les aspirations et le destin — ligne du destin, ligne du Soleil, rapport au travail et aux ambitions selon les signes.
- ## Bifurcations et intersections — les croisements significatifs entre lignes et ce qu'ils évoquent traditionnellement.
- ## Le dialogue des deux mains — lorsque deux mains sont disponibles : différences, compléments, ce que l'une montre de l'autre. Sinon, omet cette section.
- ## Synthèse — synthèse approfondie et personnalisée du parcours symbolique, dans le ton d'une chiromancienne refermant la consultation.
Chaque section : paragraphes développés, narratifs, sans répétitions automatiques, ancrés dans les observations réelles.

summary : un résumé d'une à deux phrases, ton chiromancienne.

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

    // Only hard-reject when no hand at all is visible. Quality notes are advisory otherwise.
    if (!handDetected && allObservations.length === 0) {
      await base44.entities.Scan.update(scanId, { status: 'failed', quality_notes: qualityNotes, error_message: 'Aucune main détectée' });
      return Response.json({ error: 'Aucune main détectée sur la photo. Reprenez la photo paume face à l\'objectif.', quality_notes: qualityNotes }, { status: 422 });
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