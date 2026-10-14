import React, { useState } from "react";
import { Loader2, Send, MessageCircle, HelpCircle, Lock, Infinity as InfinityIcon } from "lucide-react";
import ReadingMarkdown from "@/components/ReadingMarkdown";

export default function ChatPanel({ messages, onSend, busy, blocked, remaining, subscribed, onSubscribe, subscribeBusy, subNotice }) {
  const [input, setInput] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim();
    if (!v || busy || blocked) return;
    onSend(v, false);
    setInput("");
  };

  const signal = () => {
    if (busy || blocked) return;
    onSend("Cette interprétation ne correspond pas à mon vécu.", true);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle size={16} className="text-primary" />
        <h2 className="font-display text-xl text-primary/90">Échanger avec la chiromancienne</h2>
        {!blocked && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {subscribed
              ? "Questions illimitées"
              : `${remaining} question${remaining > 1 ? "s" : ""} gratuite${remaining > 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      <div className="space-y-3 mb-3">
        {messages.length === 0 && !blocked && (
          <p className="text-sm text-muted-foreground">
            Vous pouvez répondre à la chiromancienne, réagir à sa lecture ou lui poser une question. Elle se souvient de votre échange.
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

      {blocked ? (
        <div className="glass-card p-4 text-center">
          <Lock size={20} className="mx-auto text-primary mb-2" />
          <p className="font-display text-lg text-primary mb-1">Vous avez posé vos 3 questions gratuites</p>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Pour continuer à échanger avec la chiromancienne sans limite, souscrivez à l'abonnement des questions illimitées.
          </p>
          <button onClick={onSubscribe} disabled={subscribeBusy} className="btn-gold w-full py-3 flex items-center justify-center gap-2">
            {subscribeBusy ? <Loader2 className="animate-spin" size={16} /> : <InfinityIcon size={16} />}
            Questions illimitées — 6,99 €/mois
          </button>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            Abonnement mensuel, distinct du rapport PDF (4,99 €, paiement unique).
          </p>
          {subNotice && <p className="text-[11px] text-primary/80 mt-2 leading-relaxed">{subNotice}</p>}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">Répondez ici à la lecture ci-dessus, ou posez votre propre question. Chaque message envoyé compte pour une question gratuite.</p>
          <form onSubmit={submit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre réponse ou votre question…"
              className="flex-1 bg-input border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <button type="submit" disabled={busy || !input.trim()} className="btn-gold px-4 flex items-center gap-1">
              <Send size={14} /> <span className="text-xs">Envoyer</span>
            </button>
          </form>

          <button
            onClick={signal}
            disabled={busy}
            className="btn-ghost-gold w-full py-2 mt-2 text-xs flex items-center justify-center gap-2"
          >
            <HelpCircle size={13} /> Cette interprétation ne correspond pas à mon vécu
          </button>
        </>
      )}
    </div>
  );
}