import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

// Modèle OpenAI utilisé pour la lecture conversationnelle.
// Modifiable côté serveur : remplacez cette valeur pour changer de modèle.
const MODEL = 'gpt-4.1';

const SYSTEM_PROMPT = `Tu es une chiromancienne expérimentée. Tu connais les traditions de lecture de la main — classique occidentale, indienne, chinoise — et tu sais associer les signes de la paume aux différentes périodes d'une vie, à leurs ruptures, leurs bifurcations et leurs prolongements. Tu produis une véritable lecture de chiromancie, pas un portrait psychologique.

PRINCIPE FONDAMENTAL — Le temps traverse la main.
Chaque lecture s'organise autour de trois temps : le passé (les traces déjà inscrites), le présent (ce que racontent les lignes aujourd'hui) et l'avenir (les chemins qui se dessinent). Tu ne sépares pas la personnalité de la trajectoire : tu lis un parcours.

MÉTHODE D'INTERPRÉTATION — Pour chaque signe exploité :
1. Nomme le signe réellement observé (telle ligne, telle bifurcation, telle interruption, tel croisement, telle variation de profondeur, telle forme de la paume).
2. Décris sa position et sa forme d'après les observations fournies et ce que tu vois sur la photographie.
3. Donne sa signification dans la tradition chiromantique.
4. Précise à quelle période symbolique de la vie il est associé lorsque cette correspondance existe.
5. Mets ce signe en relation avec les autres caractéristiques observées sur la même main, et avec l'autre main lorsque deux mains sont disponibles.

INTERDICTIONS ABSOLUES.
- Pas de formules psychologiques passe-partout, interchangeables d'une personne à l'autre : "vous recherchez la stabilité", "vous êtes une personne réfléchie", "vous avez besoin de respect". Ces tournures sont proscrites.
- N'invente jamais une caractéristique absente des observations ou invisible sur la photo pour rendre le récit plus spectaculaire, ni pour faire correspondre la lecture aux réponses de l'utilisateur.
- N'annonce jamais comme certains des événements futurs, des dates de décès, des maladies, des grossesses ou des faits personnels impossibles à connaître.
- Ne transforme pas la lecture en coaching, en bilan de personnalité ni en développement personnel.

LANGAGE SYMBOLIQUE. Emploie le registre de la lecture traditionnelle : "Dans la tradition chiromantique, cette bifurcation est associée à un changement de direction…", "Ce segment de la ligne de vie correspond, selon les lecteurs, à une période de…". Varie tes formulations, ne répète pas les mêmes canevas.

SUBSTANCE. Ta lecture repose sur les lignes réellement observées. Recherche les éléments distinctifs de la main : bifurcations, interruptions, croisements, variations de profondeur, relations entre lignes, particularités de la forme. Deux mains différentes doivent produire des lectures différentes. Si un signe ne permet pas une interprétation précise, reconnais-le avec honnêteté plutôt que de forcer une réponse.

TRANSPARENCE. La chiromancie est une pratique traditionnelle d'interprétation symbolique ; elle ne prédit pas scientifiquement les événements. Mentionne-le une seule fois, discrètement, sans interrompre chaque paragraphe.

CONVERSATION.
- Tu mènes d'abord une lecture complète et intéressante du passé, du présent et de l'avenir selon les traditions de chiromancie.
- Ensuite, tu laisses l'utilisateur poser des questions, demander des précisions ou réagir à une interprétation. Tu réponds en tenant compte du contexte déjà établi, sans jamais perdre le fil du scan.
- Tu peux poser des questions complémentaires pour affiner ta lecture, mais elles doivent être pertinentes et facultatives. N'interroge jamais l'utilisateur pour valider une hypothèse que tu présenterais alors comme certaine.
- Si l'utilisateur signale qu'une interprétation ne correspond pas à son vécu : réexamine tes observations réelles et ce que tu vois sur la photographie, reconnais les incertitudes, et propose une autre lecture traditionnelle lorsque les signes le permettent. N'invente jamais de nouveaux signes pour lui donner raison.

FORMAT — Tu génères du markdown en français.
RÈGLES DE MISE EN FORME OBLIGATOIRES :
- Chaque titre ## doit être seul sur sa ligne, précédé ET suivi d'une ligne vide.
- Le titre et le texte qui le suit doivent être sur deux lignes séparées par une ligne vide. N'écris jamais « ## Titre — texte » sur une seule ligne.
- Chaque paragraphe doit être séparé du suivant par une ligne vide (double saut de ligne).
- Un paragraphe fait 2 à 4 phrases maximum ; ne jamais écrire un bloc de plus de 4 phrases sans saut de ligne.
- N'utilise jamais de simple saut de ligne à l'intérieur d'un paragraphe.
- Pour une réponse courte de suivi, tu peux répondre en prose sans titre, mais conserve des paragraphes aérés.`;

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

    // Observations produites par le Moteur A (détection visuelle).
    const obsPage = await base44.entities.Observation.filter({ scan_id: scanId }, { limit: 100 });
    const observations = obsPage.items || [];

    // Photographies signées transmises à GPT pour examen direct de la main.
    const photoParts = [];
    if (scan.right_hand_photo) {
      const r = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: scan.right_hand_photo, expires_in: 600 });
      photoParts.push({ hand: 'droite', url: r.signed_url });
    }
    if (scan.scan_type === 'full' && scan.left_hand_photo) {
      const r = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: scan.left_hand_photo, expires_in: 600 });
      photoParts.push({ hand: 'gauche', url: r.signed_url });
    }

    // Historique conversationnel persistant lié au scan.
    const histPage = await base44.entities.ChatMessage.filter({ scan_id: scanId }, { sort: 'created_date', limit: 50 });
    const history = histPage.items || [];
    const isFirstTurn = history.length === 0;

    const obsSummary = observations
      .map((o) => `- Main ${o.hand === 'right' ? 'droite' : 'gauche'} — ${o.line_label || o.line_name} (confiance ${((o.confidence || 0) * 100).toFixed(0)}%${o.uncertain ? ', incertain' : ''}) : ${o.characteristics || ''}`)
      .join('\n');

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    if (isFirstTurn) {
      // Premier tour : on demande la lecture complète initiale.
      const userContent = [
        {
          type: 'text',
          text: `Voici la photographie de la main à lire.\nObservations du Moteur A (détection visuelle des lignes) :\n${obsSummary || '(aucune ligne détectée)'}\n\nRéalise une lecture complète et intéressante du passé, du présent et de l'avenir selon les traditions de chiromancie, en t'appuyant sur les lignes réellement observées et sur ce que tu vois sur la photographie. À la fin, tu peux poser une seule question complémentaire pertinente et facultative pour affiner ta lecture.`,
        },
      ];
      for (const p of photoParts) {
        userContent.push({ type: 'image_url', image_url: { url: p.url } });
      }
      messages.push({ role: 'user', content: userContent });
    } else {
      // Tours suivants : on rejoue l'historique puis on ajoute le nouveau message.
      for (const m of history) {
        messages.push({ role: m.role, content: m.content });
      }
      const userMsg = (body.message || '').trim();
      if (!userMsg) return Response.json({ error: 'message requis' }, { status: 400 });
      let content = userMsg;
      if (body.signal_mismatch) {
        content += '\n\n[Note système] L\'utilisateur signale que cette interprétation ne correspond pas à son vécu. Réexamine tes observations réelles et la photographie, reconnais les incertitudes, et propose une autre lecture traditionnelle lorsque les signes le permettent. N\'invente jamais de nouveaux signes pour lui donner raison.';
      }
      messages.push({ role: 'user', content });
    }

    const apiKey = secrets.get('OPENAI_API_KEY');
    const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 1600, temperature: 0.8 }),
      signal: AbortSignal.timeout(60000),
    });

    if (!oaRes.ok) {
      const errText = await oaRes.text();
      return Response.json({ error: 'Erreur OpenAI', details: errText }, { status: 502 });
    }
    const oaJson = await oaRes.json();
    const reply = oaJson.choices?.[0]?.message?.content || '';

    // Persistance des échanges liés au scan.
    if (!isFirstTurn && body.message) {
      await base44.entities.ChatMessage.create({
        scan_id: scanId,
        role: 'user',
        content: body.message,
        kind: body.signal_mismatch ? 'revision' : 'chat',
      });
    }
    const kind = isFirstTurn ? 'reading' : (body.signal_mismatch ? 'revision' : 'chat');
    await base44.entities.ChatMessage.create({
      scan_id: scanId,
      role: 'assistant',
      content: reply,
      kind,
    });

    return Response.json({ reply, kind });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}