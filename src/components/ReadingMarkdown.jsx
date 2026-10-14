import React from "react";
import ReactMarkdown from "react-markdown";

export default function ReadingMarkdown({ children }) {
  return (
    <div className="prose-reading reading-markdown">
      <ReactMarkdown>{children || ""}</ReactMarkdown>
    </div>
  );
}