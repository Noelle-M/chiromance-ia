import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const COMPAT_PROMPT = `Tu es une chiromancienne expérimentée. Tu lis deux mains droites — celle de deux personnes qui s'interrogent sur leur compatibilité amoureuse — et tu produis une lecture symbolique de leur entrelacement, dans le ton d'une véritable consultation de chiromancie, pas un bilan de couple psychologique.

PRINCIPE — Le temps traverse chaque main, et la compatibilité se lit dans le dialogue de deux parcours.
Tu compares les signes réellement observés sur les deux mains et tu interprètes ce qui s'accorde, ce qui se complète, ce qui se tend, à travers le passé, le présent et l'avenir symbolique de chacun et du lien qui les unit.

MÉTHODE — Pour chaque rapprochement, suis cette logique :
1. Nomme le signe observé sur la main de l'un et/ou de l'autre (ligne, bifurcation, interruption, croisement, forme, profondeur).
2. Donne sa signification traditionnelle.
3. Précise à quelle période symbolique de la vie il est associé lorsque la correspondance existe.
4. Met en relation les signes des deux mains : ce qui résonne, ce qui dialogue, ce qui s'oppose, ce qui se complète.

INTERDICTIONS.
- Pas de formules psychologiques passe-partout ("vous communiquez bien", "vous avez besoin de tendresse", "vous êtes tous les deux sensibles").
- N'invente pas de signes absents des observations.
- N'annonce jamais comme certains des événements futurs, des ruptures, des mariages, des dates, des maladies.
- Ne donne pas de pourcentage de compatibilité ni de note chiffrée.
- Ne transforme pas la lecture en conseil conjugal ni en coaching relationnel.

LANGAGE SYMBOLIQUE. "Dans la tradition chiromantique, lorsque deux lignes de cœur présentent cette même courbure…", "Ces deux lignes de vie, l'une plus longue, l'autre marquée d'une bifurcation, évoquent deux rapports au temps différents…". Varie les formulations.

TRANSPARENCE. La chiromancie est une lecture symbolique traditionnelle ; elle ne prédit pas la réussite ni l'échec d'une relation. Mentionne-le une fois, discrètement.

FORMAT — Génère un seul contenu result_content en markdown (français), structuré ainsi :

- Une introduction qui présente le dialogue des deux mains.
- ## Les empreintes que vous portez — ce que les signes du passé racontent chez chacun, et ce qui se rejoint ou se distingue.
- ## Ce qui se joue aujourd'hui — les tendances présentes de chacun et la dynamique actuelle du lien, selon les signes observés.
- ## Les chemins qui s'entrelacent — les prolongements et bifurcations à venir, lus dans le dialogue des deux mains, au conditionnel symbolique.
- ## Le cœur et le lien — interprétation des lignes de cœur comparées : ce qui s'accorde, ce qui se complète, ce qui demande attention.
- ## Synthèse — synthèse symbolique du lien, dans le ton d'une chiromancienne refermant la consultation.

Paragraphes développés, ancrés dans les observations réelles, sans répétitions automatiques. Assez riche pour offrir une véritable lecture, sans paraître promotionnelle ni tronquée.

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
    if (!compat) return Response.json({ error: 'Compatibilité introuvable' }, { status: 404 });

    if (!compat.scan_a_id || !compat.scan_b_id) {
      return Response.json({ error: 'Les deux mains ne sont pas encore réunies.' }, { status: 422 });
    }

    const [obsAPage, obsBPage] = await Promise.all([
      base44.entities.Observation.filter({ scan_id: compat.scan_a_id }, { limit: 100 }),
      base44.entities.Observation.filter({ scan_id: compat.scan_b_id }, { limit: 100 }),
    ]);

    const summarize = (items, who) => {
      const list = items || [];
      if (!list.length) return `Main de ${who} : aucune ligne majeure clairement identifiée.`;
      return list.map((o) =>
        `- ${who} — ${o.line_label || o.line_name} (confiance ${(o.confidence * 100).toFixed(0)}%${o.uncertain ? ', incertain' : ''}) : ${o.characteristics || 'tracé observé'}`
      ).join('\n');
    };

    const obsSummary = `Main de la première personne :\n${summarize(obsAPage.items, 'première personne')}\n\nMain de la seconde personne :\n${summarize(obsBPage.items, 'seconde personne')}`;

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

    await base44.entities.Compatibility.update(compatibilityId, {
      status: 'completed',
      result_content: res.result_content,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}