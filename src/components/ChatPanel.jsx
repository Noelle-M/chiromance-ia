import React, { useState } from "react";
import { Loader2, Send, MessageCircle, HelpCircle } from "lucide-react";
import ReadingMarkdown from "@/components/ReadingMarkdown";

export default function ChatPanel({ messages, onSend, busy }) {
  const [input, setInput] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim();
    if (!v || busy) return;
    onSend(v, false);
    setInput("");
  };

  const signal = () => {
    if (busy) return;
    onSend("Cette interprétation ne correspond pas à mon vécu.", true);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle size={16} className="text-primary" />
        <h2 className="font-display text-xl text-primary/90">Échanger avec la chiromancienne</h2>
      </div>

      <div className="space-y-3 mb-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Posez une question, demandez une précision ou réagissez à une interprétation. La chiromancienne garde le contexte de votre main.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "glass-card px-3 py-2 max-w-[85%] text-sm" : "glass-card px-3 py-2 max-w-[92%]"}>
              {m.role === "user" ? m.content : <ReadingMarkdown>{m.content}</ReadingMarkdown>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="animate-spin" size={14} /> La chiromancienne médite…
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Votre question…"
          className="flex-1 bg-input border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn-gold px-4 flex items-center gap-1">
          <Send size={14} />
        </button>
      </form>

      <button
        onClick={signal}
        disabled={busy}
        className="btn-ghost-gold w-full py-2 mt-2 text-xs flex items-center justify-center gap-2"
      >
        <HelpCircle size={13} /> Cette interprétation ne correspond pas à mon vécu
      </button>
    </div>
  );
}