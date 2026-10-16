import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const COMPAT_PROMPT = `Tu rédiges une consultation de chiromancie comparative en français, précise, incarnée et lisible. Tu compares deux mains droites photographiées, sans connaître la relation entre les personnes. Il s'agit d'une lecture symbolique traditionnelle, et non d'une évaluation scientifique de leur personnalité ou de leur avenir.

MÉTHODE OBLIGATOIRE
- Pour chaque point développé, pars d'une observation VISUELLE précise de la première main et d'une observation VISUELLE précise de la seconde : ligne identifiée, position, direction, courbure, profondeur, continuité, interruption ou bifurcation, seulement si ces éléments figurent explicitement dans les données.
- Explique ce que ces signes évoquent traditionnellement, puis confronte-les : concordance, différence, complémentarité ou tension symbolique. Le lecteur doit pouvoir comprendre POURQUOI tu proposes cette interprétation.
- Distingue clairement observation, interprétation traditionnelle et hypothèse relationnelle. Utilise des formulations nuancées et naturelles, sans affirmer connaître les deux personnes.
- Mets en valeur les contrastes réels entre les observations. Ne présente pas systématiquement toute différence comme une force ni toute ressemblance comme une harmonie.
- Si une dimension n'est pas étayée par les observations, indique-le en UNE phrase claire dans la rubrique concernée. N'invente jamais un comportement, un événement, un trait psychologique, une histoire personnelle ou une caractéristique anatomique.
- Ne prétends jamais qu'une ligne non détectée est absente. N'utilise aucune affirmation sur une ligne, un mont ou un doigt qui n'apparaît pas dans les observations.
- Les pourcentages de confiance sont des indicateurs techniques : ne les reproduis pas dans le texte.
- La chiromancie est symbolique : signale-le discrètement une seule fois, sans répéter des avertissements.

STYLE
Écris comme une chiromancienne attentive qui explique ce qu'elle voit à deux personnes, avec une langue française vivante, concrète et accessible. Paragraphes fluides, phrases complètes et variées, sans ton administratif ni jargon prétentieux. Aucune répétition d'une même idée entre sections. Évite les tournures creuses et interchangeables : « page blanche », « ardoise vierge », « tabula rasa », « neutralité symbolique », « chemins qui se rejoignent », « vous naviguez », « le poids du passé », « liberté d'être », « énergie qui circule », « chacun apporte sa pierre », « tout reste à écrire », « votre force réside dans », « votre défi sera », « cela peut aussi bien ... que ... ». Ne produis pas de métaphores destinées à masquer un manque de données. N'utilise pas de phrases génériques applicables à n'importe quelles mains.

STRUCTURE MARKDOWN : conserve exactement ces titres de niveau ## pour les accordéons :
## Le dialogue de vos deux mains
## Vos affinités et vos différences
## Amitié et relations humaines
## Compatibilité affective et amoureuse
## Travailler et créer ensemble
## Projets et vie quotidienne
## Les chemins qui peuvent se rejoindre
## Votre lecture de compatibilité

Chaque rubrique doit présenter un angle DISTINCT. La dernière synthétise les 2 ou 3 concordances et différences les mieux étayées, sans répéter les paragraphes précédents. Les domaines affectifs, amicaux et professionnels sont des possibilités de lecture, jamais une affirmation que les personnes entretiennent ces relations. Si les données ne permettent pas une rubrique détaillée, rédige une seule phrase de limite plutôt qu'un développement artificiel. Ne donne ni note ni verdict absolu.

Retourne uniquement un objet JSON avec le champ result_content contenant ce markdown.`

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
      typeof o.characteristics === 'string' && o.characteristics.trim().length >= 12
    );
    const observationsA = reliable(obsAPage.items);
    const observationsB = reliable(obsBPage.items);
    if (observationsA.length < 1 || observationsB.length < 1) {
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

    const generated = String(res?.result_content || '').trim();
    if (generated.length < 850 || /tabula rasa|ardoise vierge|neutralité symbolique|page blanche/i.test(generated) || (generated.match(/^## /gm) || []).length !== 8) {
      return Response.json({ error: 'lecture_non_conforme', message: 'La lecture ne répond pas aux exigences de précision. Relancez l’analyse.' }, { status: 422 });
    }

    await base44.asServiceRole.entities.Compatibility.update(compatibilityId, {
      status: 'completed',
      result_content: generated,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}