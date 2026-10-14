import React from "react";
import ReactMarkdown from "react-markdown";

// The AI sometimes glues a "##" title inline with the surrounding paragraph
// (e.g. "...texte. ## Titre — paragraphe..."), which is not valid Markdown:
// react-markdown then treats "##" as literal text instead of a heading.
// This light pass only restores valid Markdown structure so the library can
// render real <h2>/<p> elements. The original string stored in the database is
// never modified — conversion happens only at display time.
const rescueMarkdown = (md) => {
  if (!md) return "";
  let s = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Heading glued to preceding text on the same line → break to its own line.
  s = s.replace(/(\S)[ \t]*(#{1,6} )/g, "$1\n\n$2");
  // Heading on its own line but missing the blank line before it.
  s = s.replace(/([^\n])\n(#{1,6} )/g, "$1\n\n$2");
  // "## Title — body" on one line → split the title from its body paragraph.
  s = s.replace(/(#{1,6} [^\n]+?)\s+[—–-]\s+([^\n])/g, "$1\n\n$2");
  // Missing blank line after a heading line.
  s = s.replace(/(#{1,6}[^\n]+)\n([^\n#])/g, "$1\n\n$2");
  // Collapse excessive blank lines.
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
};

export default function ReadingMarkdown({ children }) {
  return (
    <div className="prose-reading reading-markdown">
      <ReactMarkdown>{rescueMarkdown(children || "")}</ReactMarkdown>
    </div>
  );
}