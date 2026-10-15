import { jsPDF } from "jspdf";

// Les planches pédagogiques sont des pages A4 complètes : ne pas superposer
// d'autres titres ni légendes sur leurs textes intégrés.
const A4_W = 210;
const A4_H = 297;
const GOLD = [174, 124, 40];
const INK = [55, 38, 51];
const MUTED = [108, 85, 85];
const IMAGE_PATHS = {
  background: "/fond%20page.png",
  hands: "/main%20gauche%20-%20main%20droite.png",
  map: "/La%20carte%20de%20votre%20main.png",
  heart: "/Ligne%20de%20coeur.png",
  head: "/ligne%20de%20t%C3%AAte.png",
};

function textSafe(value) {
  return String(value || "").normalize("NFC")
    .replace(/[\u00a0\u202f\u2007]/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ").trim();
}

async function imageData(url, maxSide = 1750, quality = 0.83) {
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Image introuvable : " + url);
  const blob = await response.blob();
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    const obj = URL.createObjectURL(blob);
    el.onload = () => { URL.revokeObjectURL(obj); resolve(el); };
    el.onerror = () => { URL.revokeObjectURL(obj); reject(new Error("Image illisible")); };
    el.src = obj;
  });
  const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * ratio);
  canvas.height = Math.round(img.naturalHeight * ratio);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL("image/jpeg", quality), width: canvas.width, height: canvas.height };
}

function drawContained(doc, image, x, y, w, h) {
  if (!image) return;
  const scale = Math.min(w / image.width, h / image.height);
  const iw = image.width * scale, ih = image.height * scale;
  doc.addImage(image.data, "JPEG", x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, undefined, "FAST");
}

function fullPage(doc, image) {
  if (!image) return;
  // A4 page art is intended to cover the whole page.
  doc.addImage(image.data, "JPEG", 0, 0, A4_W, A4_H, undefined, "FAST");
}

function makePage(doc, background, title, chapter, pageNum) {
  doc.addPage();
  if (background) fullPage(doc, background);
  else { doc.setFillColor(252, 246, 233); doc.rect(0, 0, A4_W, A4_H, "F"); }
  doc.setCharSpace(0);
  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  const titles = doc.splitTextToSize(textSafe(title), 154);
  doc.text(titles, 28, 40);
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(textSafe(chapter).toUpperCase(), 28, 22);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(28, 43 + (titles.length - 1) * 8, 182, 43 + (titles.length - 1) * 8);
  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("CHIROMANCIE IA  |  Lecture symbolique", 28, 276);
  doc.text(String(pageNum), 181, 276, { align: "right" });
  return 54 + (titles.length - 1) * 8;
}

function paragraphs(md) {
  return String(md || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*#{1,6}\s*$/gm, "")
    .replace(/\\\n/g, "\n")
    .split(/\n\s*\n/)
    .map(x => x.replace(/^#{1,6}\s+/, "").trim())
    .filter(Boolean);
}

function normalizeHeading(str) {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function sectionsOf(markdown) {
  const result = [];
  const source = String(markdown || "").replace(/\r\n?/g, "\n");
  const parts = source.split(/^#{1,3}\s+(.+)$/gm);
  if (parts[0].trim()) result.push({ title: "Introduction", text: parts[0].trim() });
  for (let i = 1; i < parts.length; i += 2) {
    result.push({ title: parts[i].trim(), text: (parts[i + 1] || "").trim() });
  }
  return result;
}

const TOPICS = [
  { id: "life", title: "Votre ligne de vie", chapter: "Vos lignes", match: /ligne de vie|vitalite|energie|elan de vie/ },
  { id: "fate", title: "Votre ligne du destin", chapter: "Vos lignes", match: /destin|profession|travail|orientation|choix de vie/ },
  { id: "signs", title: "Les signes particuliers", chapter: "Les signes", match: /signes|ramification|secondaire|fourche|croisement|particularit/ },
  { id: "mounts", title: "Les monts de votre main", chapter: "Les signes", match: /monts|reliefs|venus|lune|mars|mercure|jupiter|saturne/ },
  { id: "past", title: "Les empreintes du passé", chapter: "Votre parcours", match: /passe|enfance|hier|origines/ },
  { id: "present", title: "Ce que raconte votre présent", chapter: "Votre parcours", match: /present|actuel|aujourd.hui/ },
  { id: "future", title: "Les chemins possibles de l'avenir", chapter: "Votre parcours", match: /avenir|futur|perspective|demain/ },
  { id: "links", title: "Quand vos lignes se répondent", chapter: "Votre portrait", match: /relation entre|interaction|ensemble|crois|depart commun|liens entre/ },
  { id: "portrait", title: "Votre portrait chiromantique", chapter: "Votre portrait", match: /portrait|personnalite|temperament|affectif|coeur|tete|reflexion/ },
  { id: "conclusion", title: "Ce qui distingue votre main", chapter: "Votre portrait", match: /synthese|conclusion|en resume|pour finir|particularite/ },
];

const EXPLAINS = {
  life: "En chiromancie, la ligne de vie décrit symboliquement l'élan vital et les étapes d'un parcours. Sa longueur ne permet pas de déterminer la durée de vie.",
  fate: "La ligne du destin est traditionnellement associée aux orientations, aux engagements et aux choix de parcours. Elle peut être discrète ou absente.",
  signs: "Une branche, une fourche ou un croisement n'a de sens dans une lecture personnalisée que s'il est réellement discernable sur la photographie.",
  mounts: "Les monts sont les reliefs de la paume. Leur interprétation appartient aux traditions de chiromancie et varie selon les écoles.",
  past: "Les signes de la main peuvent nourrir une lecture symbolique du passé, mais ils ne permettent pas de reconstituer des événements biographiques certains.",
  present: "La lecture du présent met en relation les caractéristiques visibles de la main et les significations que leur attribue la tradition.",
  future: "Les pistes évoquées ici sont des interprétations symboliques et des possibilités, jamais des prédictions garanties.",
  links: "Une ligne ne s'interprète pas isolément : sa direction et ses rapports avec les autres tracés peuvent nuancer la lecture.",
  portrait: "Ce portrait rassemble les particularités observables de votre main plutôt qu'une description générique de personnalité.",
  conclusion: "Une lecture de main est une interprétation symbolique. Elle n'établit ni diagnostic, ni certitude sur votre histoire ou votre avenir.",
};

function distribute(markdown) {
  const grouped = Object.fromEntries(TOPICS.map(t => [t.id, []]));
  const sections = sectionsOf(markdown);
  const leftovers = [];
  for (const section of sections) {
    const title = normalizeHeading(section.title);
    const topic = TOPICS.find(t => t.match.test(title));
    if (topic) grouped[topic.id].push(section.text);
    else leftovers.push(section.text);
  }
  // Older reports lack standard headings. Preserve their text without duplicating it.
  const free = leftovers.flatMap(paragraphs);
  for (const p of free) {
    const norm = normalizeHeading(p.slice(0, 170));
    const topic = TOPICS.find(t => t.match.test(norm));
    if (topic) grouped[topic.id].push(p);
    else grouped.portrait.push(p);
  }
  return grouped;
}

function renderParagraphs(doc, background, page, text, pageNum, startY) {
  let y = startY;
  doc.setCharSpace(0);
  const blocks = paragraphs(text);
  for (const block of blocks) {
    const plain = textSafe(block);
    if (!plain) continue;
    doc.setFont("times", "normal");
    doc.setFontSize(11.3);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(plain, 151);
    // Keep paragraph together when possible.
    const needed = lines.length * 6.2 + 6;
    if (y + needed > 264 && y > 85) {
      y = makePage(doc, background, page.title + " (suite)", page.chapter, ++pageNum);
    }
    for (const line of lines) {
      if (y > 263) y = makePage(doc, background, page.title + " (suite)", page.chapter, ++pageNum);
      doc.text(line, 29, y);
      y += 6.2;
    }
    y += 6;
  }
  return pageNum;
}

function infoPage(doc, background, topic, content, pageNum) {
  const y = makePage(doc, background, topic.title, topic.chapter, pageNum);
  doc.setFont("times", "italic");
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  const intro = doc.splitTextToSize(textSafe(EXPLAINS[topic.id]), 150);
  doc.text(intro, 29, y + 2);
  const afterIntro = y + 10 + intro.length * 5.4;
  doc.setDrawColor(...GOLD);
  doc.line(29, afterIntro - 4, 67, afterIntro - 4);
  if (!content?.trim()) {
    doc.setFont("times", "normal");
    doc.setFontSize(11.2);
    doc.setTextColor(...INK);
    const message = "La photographie ne permet pas de développer davantage ce point avec suffisamment de précision. Aucune observation n'a été ajoutée artificiellement.";
    doc.text(doc.splitTextToSize(message, 151), 29, afterIntro + 9);
    return pageNum;
  }
  return renderParagraphs(doc, background, topic, content, pageNum, afterIntro + 8);
}

export async function generateReportPdf({ reading, rightPhotoUrl, leftPhotoUrl, scanDate, userName }) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const entries = await Promise.all(
    Object.entries(IMAGE_PATHS).map(async ([key, path]) => [key, await imageData(path).catch(() => null)])
  );
  const assets = Object.fromEntries(entries);
  // The shared parchment background is required for the designed report.
  if (!assets.background) throw new Error("Le fond du rapport est introuvable dans public.");
  const [right, left] = await Promise.all([
    imageData(rightPhotoUrl, 1400, 0.85).catch(() => null),
    imageData(leftPhotoUrl, 1400, 0.85).catch(() => null),
  ]);
  const full = reading?.full_content || reading?.free_content || "";
  const groups = distribute(full);

  // 1. Couverture
  doc.setFillColor(36, 21, 43);
  doc.rect(0, 0, A4_W, A4_H, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.roundedRect(12, 12, 186, 273, 3, 3, "S");
  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.setTextColor(233, 195, 114);
  doc.text("CHIROMANCIE IA", 105, 43, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(16);
  doc.setTextColor(251, 240, 224);
  doc.text("Votre main, votre histoire", 105, 56, { align: "center" });
  if (right || left) drawContained(doc, right || left, 40, 72, 130, 157);
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(233, 195, 114);
  if (userName) doc.text(textSafe(userName), 105, 246, { align: "center" });
  if (scanDate) {
    const date = new Date(scanDate);
    if (!Number.isNaN(date.getTime())) doc.text(date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }), 105, 255, { align: "center" });
  }
  doc.setFontSize(9);
  doc.setTextColor(226, 214, 219);
  doc.text("Une consultation symbolique personnalisée", 105, 273, { align: "center" });

  // 2. Photo personnelle
  let page = 2;
  let y = makePage(doc, assets.background, left ? "Vos deux mains" : "Votre main", "Découvrir votre main", page);
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Les photographies originales de votre consultation", 29, y + 5);
  if (right && left) {
    doc.text("Main droite", 32, y + 17);
    doc.text("Main gauche", 113, y + 17);
    drawContained(doc, right, 29, y + 23, 73, 155);
    drawContained(doc, left, 110, y + 23, 73, 155);
  } else if (right || left) {
    drawContained(doc, right || left, 43, y + 15, 124, 164);
  }
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  const photoNote = left
    ? "La comparaison des deux mains permet d'explorer des nuances de lecture. Chaque observation reste liée à ce qui est visible."
    : "Cette consultation repose sur une seule main photographiée. L'autre main ne peut pas être décrite sans photographie.";
  doc.text(doc.splitTextToSize(photoNote, 150), 29, 247);

  // 3–6. Planches illustrées fournies par l'autrice.
  const illustrations = [
    ["hands", "Main gauche et main droite"],
    ["map", "Carte de la main"],
    ["heart", "Ligne du coeur"],
    ["head", "Ligne de tête"],
  ];
  for (const [key, label] of illustrations) {
    if (assets[key]) {
      doc.addPage();
      fullPage(doc, assets[key]);
      page++;
    } else {
      page++;
      makePage(doc, assets.background, label, "Découvrir votre main", page);
      doc.text("Illustration indisponible dans le dossier public.", 29, 73);
    }
  }

  // 7–16. Lecture personnelle structurée : une section par thème,
  // avec pages de continuation si le texte le nécessite.
  for (const topic of TOPICS) {
    page++;
    page = infoPage(doc, assets.background, topic, (groups[topic.id] || []).join("\n\n"), page);
  }
  return doc.output("blob");
}
