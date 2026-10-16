import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const COMPAT_PROMPT = `Tu es une chiromancienne expérimentée. Tu compares les deux mains droites de deux personnes pour une lecture de compatibilité globale, selon les traditions symboliques de chiromancie. Ne présume jamais qu'elles sont amoureuses, en couple, parentes, amies ou collègues. Explore plusieurs formes de relation possibles sans inventer leur relation réelle.

Tu t'appuies exclusivement sur les observations fournies pour chacune des mains : lignes, courbures, bifurcations, croisements, continuité, profondeur et autres signes effectivement relevés. Pour chaque interprétation, indique les signes comparés et leur signification traditionnelle. Si les observations ne permettent pas une interprétation précise, explique cette limite.

Étudie les accords, les complémentarités, les contrastes et les tensions symboliques dans les domaines suivants :
- Affinités humaines : tempéraments symboliques, manière de se rejoindre, amitié, confiance et compréhension mutuelle.
- Relation affective et amoureuse : harmonie des lignes de cœur, complémentarités et points de friction possibles, sans présumer d'un couple existant.
- Collaboration et travail : façon symbolique d'aborder les projets, initiatives, rythme, organisation, décision et coopération.
- Projets communs et vie quotidienne : rapport aux changements, aux responsabilités, aux choix et aux imprévus.
- Évolution du lien : correspondances symboliques entre passé, présent et trajectoires possibles, sans prédiction certaine.

Rédige une consultation riche et personnalisée en français, avec des paragraphes développés. Évite les banalités psychologiques, les diagnostics, les pourcentages et les notes de compatibilité. Ne déduis jamais d'une paume des compétences professionnelles, une personnalité ou une compatibilité réelle démontrée. Ne promets aucun événement futur. Une fois, précise discrètement que la chiromancie relève d'une tradition symbolique et ne permet pas d'établir scientifiquement la réussite d'une relation ou d'une collaboration.

Retourne un seul champ result_content en markdown, structuré ainsi :
## Le dialogue de vos deux mains
## Vos affinités et vos différences
## Amitié et relations humaines
## Compatibilité affective et amoureuse
## Travailler et créer ensemble
## Projets et vie quotidienne
## Les chemins qui peuvent se rejoindre
## Votre lecture de compatibilité

Interdiction de présenter une ligne non détectée comme absente de la main. Interdiction des concepts inventés comme « main tabula rasa », « ardoise vierge », « neutralité symbolique ». Chaque affirmation doit citer un signe concret présent dans les observations. Si un domaine ne peut être interprété, indique sobrement cette limite au lieu de remplir avec des métaphores. Chaque section doit confronter les signes réellement observés sur les deux mains. Développe aussi bien les correspondances favorables que les différences, sans conclure automatiquement que les personnes sont compatibles ou incompatibles.

Retourne un JSON conforme au schéma demandé.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const compatibilityId = body.compatibility_id;
    if (!compatibilityId) return Response.json({ error: 'compatibility_id requis' }, { status: 400 });

    const compat = await base44.entities.Compatibility.get(compatibilityId);
    if (!compat || ![compat.participant_a_id, compat.participant_b_id].includes(user.id)) return Response.json({ error: 'Accès refusé' }, { status: 403 });
    if (compat.status === 'completed') return Response.json({ ok: true });
    if (compat.status !== 'accepted' || !compat.consent_a || !compat.consent_b || !compat.participant_b_id || compat.participant_a_id === compat.participant_b_id) return Response.json({ error: 'Invitation non acceptée par deux personnes' }, { status: 409 });
    const scanA = await base44.asServiceRole.entities.Scan.get(compat.scan_a_id);
    const scanB = await base44.asServiceRole.entities.Scan.get(compat.scan_b_id);
    if (!scanA || !scanB || scanA.created_by_id !== compat.participant_a_id || scanB.created_by_id !== compat.participant_b_id || scanA.scan_type !== 'compatibility' || scanB.scan_type !== 'compatibility' || scanA.status !== 'analyzed' || scanB.status !== 'analyzed') return Response.json({ error: 'Scans invalides' }, { status: 403 });

    if (!compat.scan_a_id || !compat.scan_b_id) {
      return Response.json({ error: 'Les deux mains ne sont pas encore réunies.' }, { status: 422 });
    }

    const [obsAPage, obsBPage] = await Promise.all([
      base44.asServiceRole.entities.Observation.filter({ scan_id: compat.scan_a_id }, { limit: 100 }),
      base44.asServiceRole.entities.Observation.filter({ scan_id: compat.scan_b_id }, { limit: 100 }),
    ]);

    const reliable = (items) => (items || []).filter(o =>
      o.hand === 'right' &&
      !o.uncertain &&
      Number(o.confidence) >= 0.55 &&
      Array.isArray(o.coordinates) && o.coordinates.length >= 2 &&
      typeof o.characteristics === 'string' && o.characteristics.trim().length >= 12
    );
    const observationsA = reliable(obsAPage.items);
    const observationsB = reliable(obsBPage.items);
    if (observationsA.length < 2 || observationsB.length < 2) {
      return Response.json({
        error: 'observations_insuffisantes',
        message: 'Les lignes des deux mains ne sont pas assez visibles pour une comparaison. Reprenez les photos avec la paume ouverte et une lumière uniforme.'
      }, { status: 422 });
    }

    const summarize = (items, who) => {
      const list = items || [];
      if (!list.length) return `Main de ${who} : aucune ligne majeure clairement identifiée.`;
      return list.map((o) =>
        `- ${who} — ${o.line_label || o.line_name} (confiance ${(o.confidence * 100).toFixed(0)}%${o.uncertain ? ', incertain' : ''}) : ${o.characteristics || 'tracé observé'}`
      ).join('\n');
    };

    const obsSummary = `Main de la première personne :\n${summarize(observationsA, 'première personne')}\n\nMain de la seconde personne :\n${summarize(observationsB, 'seconde personne')}`;

    const schema = {
      type: 'object',
      properties: {
        result_content: { type: 'string' },
      },
      required: ['result_content'],
    };

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${COMPAT_PROMPT}\n\nObservations visuelles fournies par le Moteur A pour les deux mains droites :\n${obsSummary}`,
      response_json_schema: schema,
    });

    await base44.asServiceRole.entities.Compatibility.update(compatibilityId, {
      status: 'completed',
      result_content: res.result_content,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}