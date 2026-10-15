import React from "react";
import { ChevronDown } from "lucide-react";
import ReadingMarkdown from "@/components/ReadingMarkdown";

// Keep the saved report untouched. Only change how it is displayed on screen.
function splitChapters(markdown) {
  const text = String(markdown || "").replace(/\r\n?/g, "\n")
    .replace(/(\S)[ \t]*(#{1,3} )/g, "$1\n\n$2")
    .replace(/^\s*#{1,6}\s*$/gm, "");
  const lines = text.split("\n");
  const chapters = [];
  let current = { title: "Introduction", body: [] };
  for (const line of lines) {
    const match = line.match(/^\s*#{1,3}\s+(.+?)\s*$/);
    if (match) {
      if (current.body.join("").trim()) chapters.push(current);
      current = { title: match[1].replace(/\*\*/g, "").trim(), body: [] };
    } else current.body.push(line);
  }
  if (current.body.join("").trim()) chapters.push(current);
  return chapters;
}

export default function ReportAccordion({ content }) {
  const chapters = splitChapters(content);
  if (!chapters.length) return null;
  return (
    <div className="space-y-2">
      {chapters.map((chapter, index) => (
        <details key={index} className="group rounded-xl border border-primary/30 bg-white/[0.035] overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-primary font-display text-lg hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
            <span>{chapter.title}</span>
            <ChevronDown size={18} className="shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-primary/20 px-4 pt-4 pb-5">
            <ReadingMarkdown>{chapter.body.join("\n").trim()}</ReadingMarkdown>
          </div>
        </details>
      ))}
    </div>
  );
}
