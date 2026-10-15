import { jsPDF } from "jspdf";

const GOLD = [183, 139, 49];
const DARK = [27, 18, 33];
const TEXT = [47, 38, 48];
const GRAY = [114, 103, 112];
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 23;
const RIGHT = PAGE_W - MARGIN;
const WIDTH = RIGHT - MARGIN;

async function loadPhoto(url) {
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Photo inaccessible");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      const data = canvas.toDataURL("image/jpeg", 0.88);
      URL.revokeObjectURL(objectUrl);
      resolve({ data, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Photo illisible")); };
    img.src = objectUrl;
  });
}

function footer(doc) {
  const n = doc.getNumberOfPages();
  for (let i = 2; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(223, 209, 178);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, 278, RIGHT, 278);
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text("CHIROMANCIE IA  ·  Lecture symbolique", MARGIN, 285);
    doc.text(String(i - 1), RIGHT, 285, { align: "right" });
  }
}

function newContentPage(doc, heading) {
  doc.addPage();
  doc.setFillColor(255, 254, 251);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.55);
  doc.line(MARGIN, 19, RIGHT, 19);
  if (heading) {
    doc.setFont("times", "bold");
    doc.setFontSize(19);
    doc.setTextColor(...DARK);
    doc.text(heading, MARGIN, 34);
    return 44;
  }
  return 31;
}

function cleanMarkdown(markdown) {
  return String(markdown || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\\\n/g, "\n")
    .replace(/^\s*#{1,6}\s*$/gm, "")
    .replace(/^(#{1,6})\s+(.+?)\s+[—–]\s+(.+)$/gm, "$1 $2\n\n$3")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeText(text) {
  return String(text || "")
    .normalize("NFC")
    .replace(/[\u00a0\u202f\u2007]/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ").trim();
}

function wrapSafe(doc, text, width) {
  const words = safeText(text).split(" ").filter(Boolean);
  const result = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (doc.getTextWidth(candidate) <= width - 3) {
      line = candidate;
    } else {
      if (line) result.push(line);
      line = word;
      // Prevent a single oversized token from escaping the right margin.
      while (doc.getTextWidth(line) > width - 3 && line.length > 1) {
        let n = line.length - 1;
        while (n > 1 && doc.getTextWidth(line.slice(0, n)) > width - 3) n--;
        result.push(line.slice(0, n));
        line = line.slice(n);
      }
    }
  }
  if (line) result.push(line);
  return result;
}

function renderContent(doc, markdown, y) {
  const blocks = cleanMarkdown(markdown).split(/\n\s*\n/);\n  doc.setCharSpace(0);
  const bottom = 266;
  const ensure = (height) => {
    if (y + height > bottom) y = newContentPage(doc, "");
  };
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    const heading = block.match(/^(#{1,3})\s+([^\n]+)/);
    if (heading) {
      const title = heading[2].replace(/\*\*/g, "").trim();
      doc.setFont("times", "bold");
      doc.setFontSize(15);
      const lines = wrapSafe(doc, title, WIDTH);
      const height = lines.length * 7 + 9;
      ensure(height + 13);
      y += 6;
      doc.setTextColor(...GOLD);
      doc.text(lines, MARGIN, y);
      y += lines.length * 7 + 1;
      doc.setDrawColor(220, 194, 130);
      doc.setLineWidth(0.25);
      doc.line(MARGIN, y, MARGIN + 38, y);
      y += 8;
      const rest = block.slice(heading[0].length).trim();
      if (!rest) continue;
      // If a heading and paragraph were glued together, render the remainder.
      const paras = rest.split("\n");
      for (const para of paras) {
        doc.setFont("times", "normal");
        doc.setFontSize(11.5);
        doc.setTextColor(...TEXT);
        const lines2 = wrapSafe(doc, para.replace(/\*\*/g, ""), WIDTH);
        for (const line of lines2) { ensure(6); doc.text(line, MARGIN, y); y += 5.7; }
        y += 3;
      }
      continue;
    }
    const normalized = block.replace(/\*\*/g, "").replace(/^[-*]\s+/gm, "• ");
    doc.setFont("times", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(...TEXT);
    const lines = wrapSafe(doc, normalized, WIDTH);
    for (const line of lines) {
      ensure(6.5);
      doc.text(line, MARGIN, y);
      y += 5.8; // jsPDF coordinates are millimetres, not points.
    }
    y += 4.5;
  }
}

function drawPhoto(doc, photo, x, y, maxW, maxH) {
  if (!photo) return 0;
  const scale = Math.min(maxW / photo.width, maxH / photo.height);
  const w = photo.width * scale;
  const h = photo.height * scale;
  const left = x + (maxW - w) / 2;
  doc.setFillColor(...DARK);
  doc.roundedRect(left - 1.8, y - 1.8, w + 3.6, h + 3.6, 2.5, 2.5, "F");
  doc.addImage(photo.data, "JPEG", left, y, w, h, undefined, "FAST");
  return h;
}

export async function generateReportPdf({ reading, rightPhotoUrl, leftPhotoUrl, scanDate, userName }) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const right = await loadPhoto(rightPhotoUrl).catch(() => null);
  const left = await loadPhoto(leftPhotoUrl).catch(() => null);

  // Elegant cover with the photographed hand as the visual focus.
  doc.setFillColor(...DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.rect(14, 14, PAGE_W - 28, PAGE_H - 28);
  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.setTextColor(232, 195, 111);
  doc.text("Chiromancie IA", PAGE_W / 2, 46, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(15);
  doc.setTextColor(245, 235, 219);
  doc.text("Votre rapport de lecture", PAGE_W / 2, 59, { align: "center" });
  doc.setDrawColor(...GOLD);
  doc.line(77, 68, 133, 68);
  if (right || left) drawPhoto(doc, right || left, 43, 78, 124, 150);
  if (userName) {
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(245, 235, 219);
    doc.text(userName, PAGE_W / 2, 239, { align: "center" });
  }
  if (scanDate) {
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.setTextColor(232, 195, 111);
    doc.text(new Date(scanDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }), PAGE_W / 2, 249, { align: "center" });
  }
  doc.setFont("times", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(213, 203, 209);
  doc.text("Lecture traditionnelle et symbolique, sans valeur prédictive scientifique.", PAGE_W / 2, 273, { align: "center" });

  // Photo page: no obsolete coordinates or empty line legend.
  let y = newContentPage(doc, left ? "Vos deux mains" : "Votre main");
  doc.setFont("times", "italic");
  doc.setFontSize(10.5);
  doc.setTextColor(...GRAY);
  doc.text("Photographie originale utilisée pour votre consultation", MARGIN, y + 2);
  y += 15;
  if (left && right) {
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text("Main droite", 25, y);
    doc.text("Main gauche", 112, y);
    drawPhoto(doc, right, 25, y + 7, 72, 173);
    drawPhoto(doc, left, 112, y + 7, 72, 173);
  } else if (right || left) {
    drawPhoto(doc, right || left, 43, y + 1, 124, 183);
  }

  y = newContentPage(doc, "Votre lecture approfondie");
  renderContent(doc, reading?.full_content || reading?.free_content || "Aucune lecture disponible.", y);
  footer(doc);
  return doc.output("blob");
}