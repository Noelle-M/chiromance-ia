import { jsPDF } from "jspdf";

const GOLD = [204, 163, 62];
const INK = [18, 12, 23];
const PLUM = [45, 30, 56];
const MUTED = [90, 78, 100];

const LINE_LABELS = {
  life: "Ligne de vie",
  heart: "Ligne de cœur",
  head: "Ligne de tête",
  fate: "Ligne du destin",
  sun: "Ligne du Soleil",
  mercury: "Ligne de Mercure",
  secondary: "Ligne secondaire",
};

async function urlToDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function drawAnnotatedHand(doc, photoUrl, observations, title, layout) {
  const { x, y, w, h } = layout;
  // Frame
  doc.setFillColor(20, 14, 28);
  doc.roundedRect(x - 2, y - 2, w + 4, h + 4, 2, 2, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, x, y - 6);

  return urlToDataUrl(photoUrl).then((dataUrl) => {
    doc.addImage(dataUrl, "JPEG", x, y, w, h, undefined, "FAST");
    // Overlay lines
    doc.setLineWidth(0.7);
    const byHand = {};
    observations.forEach((o) => {
      if (!o.coordinates || o.coordinates.length < 2) return;
      (byHand[o.hand] = byHand[o.hand] || []).push(o);
    });
    Object.entries(byHand).forEach(([hand, obs], idx) => {
      doc.setDrawColor(...GOLD);
      obs.forEach((o) => {
        const pts = o.coordinates;
        for (let i = 0; i < pts.length - 1; i++) {
          const x1 = x + pts[i].x * w;
          const y1 = y + pts[i].y * h;
          const x2 = x + pts[i + 1].x * w;
          const y2 = y + pts[i + 1].y * h;
          doc.line(x1, y1, x2, y2);
        }
      });
    });
  });
}

function addWrappedText(doc, text, opts) {
  const { x, maxWidth, startY, maxY, fontSize = 10, font = "normal", color = INK, lineGap = 1.5 } = opts;
  doc.setFont("helvetica", font);
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxWidth);
  let y = startY;
  for (const ln of lines) {
    if (y > maxY) {
      doc.addPage();
      y = 20;
    }
    doc.text(ln, x, y);
    y += fontSize * lineGap;
  }
  return y;
}

function renderMarkdown(doc, markdown, x, maxWidth, startY, maxY) {
  let y = startY;
  const blocks = markdown.split(/\n/);
  for (const raw of blocks) {
    const line = raw.trim();
    if (!line) {
      y += 4;
      continue;
    }
    if (line.startsWith("## ")) {
      y += 6;
      if (y > maxY - 10) { doc.addPage(); y = 20; }
      y = addWrappedText(doc, line.replace(/^## /, ""), { x, maxWidth, startY: y, maxY, fontSize: 14, font: "bold", color: GOLD, lineGap: 1.6 });
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.3);
      doc.line(x, y - 2, x + 30, y - 2);
      y += 4;
    } else if (line.startsWith("### ")) {
      y += 4;
      y = addWrappedText(doc, line.replace(/^### /, ""), { x, maxWidth, startY: y, maxY, fontSize: 12, font: "bold", color: PLUM });
    } else if (line.startsWith("- ")) {
      y = addWrappedText(doc, "• " + line.replace(/^- /, ""), { x: x + 4, maxWidth: maxWidth - 4, startY: y, maxY, fontSize: 10, color: INK });
    } else {
      y = addWrappedText(doc, line, { x, maxWidth, startY: y, maxY, fontSize: 10, color: INK });
    }
  }
  return y;
}

export async function generateReportPdf({
  reading,
  observations = [],
  rightPhotoUrl,
  leftPhotoUrl,
  scanDate,
  userName,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const contentW = pageW - margin * 2;

  // ---- Cover ----
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.rect(margin, margin, pageW - margin * 2, pageH - margin * 2);
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text("Chiromance IA", pageW / 2, 70, { align: "center" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Rapport de lecture des mains", pageW / 2, 82, { align: "center" });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.2);
  doc.line(pageW / 2 - 25, 92, pageW / 2 + 25, 92);
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(scanDate ? new Date(scanDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "", pageW / 2, 104, { align: "center" });
  if (userName) {
    doc.setFontSize(13);
    doc.text(userName, pageW / 2, 120, { align: "center" });
  }
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text("Pratique traditionnelle d'interprétation symbolique.", pageW / 2, pageH - 40, { align: "center" });
  doc.text("La chiromancie ne prédit pas scientifiquement les événements.", pageW / 2, pageH - 35, { align: "center" });

  // ---- Annotated hands ----
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Vos mains annotées", margin, 26);
  const handW = 80;
  const handH = 110;
  const rightObs = observations.filter((o) => o.hand === "right");
  const leftObs = observations.filter((o) => o.hand === "left");

  if (rightPhotoUrl) {
    await drawAnnotatedHand(doc, rightPhotoUrl, rightObs, "Main droite", { x: margin, y: 36, w: handW, h: handH });
  }
  if (leftPhotoUrl) {
    await drawAnnotatedHand(doc, leftPhotoUrl, leftObs, "Main gauche", { x: pageW - margin - handW, y: 36, w: handW, h: handH });
  }

  // Legend
  const legendY = 160;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Lignes identifiées", margin, legendY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const seen = new Set();
  let ly = legendY + 6;
  observations.forEach((o) => {
    const key = `${o.hand}-${o.line_name}`;
    if (seen.has(key)) return;
    seen.add(key);
    const label = o.line_label || LINE_LABELS[o.line_name] || o.line_name;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(margin, ly - 1, margin + 6, ly - 1);
    doc.setTextColor(...INK);
    doc.text(`${label}${o.uncertain ? " (incertain)" : ""} — ${o.characteristics || "tracé observé"}`, margin + 9, ly);
    ly += 5;
    if (ly > pageH - 20) return;
  });

  // ---- Reading content ----
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");
  renderMarkdown(doc, reading?.full_content || reading?.free_content || "", margin, contentW, 26, pageH - margin);

  return doc.output("blob");
}