import React, { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Loader2, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";

const PART_TITLES = {
  1: "Découvrir la chiromancie",
  2: "Comprendre les mains",
  3: "Les grandes lignes",
  4: "Les signes particuliers",
  5: "Les méthodes d'interprétation",
};

export default function Learn() {
  const [courses, setCourses] = useState([]);
  const [progress, setProgress] = useState(null);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const page = await base44.entities.Course.filter({}, { sort: 'order', limit: 200 });
      const items = page.items || [];
      setCourses(items);
      const pPage = await base44.entities.CourseProgress.filter({}, { limit: 1 });
      let p = pPage.items?.[0];
      if (!p) p = await base44.entities.CourseProgress.create({ completed_ids: [] });
      setProgress(p);
      const resume = items.find((c) => c.id === p.last_course_id) || items[0];
      if (resume) openSheet(resume, p);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openSheet = async (sheet, p = progress) => {
    setCurrent(sheet);
    if (!p) return;
    const updated = await base44.entities.CourseProgress.update(p.id, { last_course_id: sheet.id });
    setProgress({ ...p, last_course_id: sheet.id });
  };

  const markComplete = async () => {
    if (!progress || !current) return;
    const done = new Set(progress.completed_ids || []);
    done.add(current.id);
    const arr = Array.from(done);
    const updated = await base44.entities.CourseProgress.update(progress.id, { completed_ids: arr });
    setProgress({ ...progress, completed_ids: arr });
  };

  const idx = courses.findIndex((c) => c.id === current?.id);
  const go = (delta) => {
    const next = courses[idx + delta];
    if (next) openSheet(next);
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-primary" /></div>;

  if (!current) {
    return (
      <div className="px-6 pt-12 max-w-md mx-auto text-center">
        <BookOpen size={28} className="mx-auto text-primary/50 mb-3" />
        <p className="text-sm text-muted-foreground">Les cours sont en cours de chargement.</p>
      </div>
    );
  }

  const parts = {};
  courses.forEach((c) => { (parts[c.part] ||= []).push(c); });
  const partKeys = Object.keys(parts).map(Number).sort((a, b) => a - b);

  return (
    <div className="px-5 pt-10 pb-8 max-w-md mx-auto">
      <header className="mb-5">
        <h1 className="font-display text-3xl">Apprendre</h1>
        <p className="text-sm text-muted-foreground mt-1">Cours progressif et gratuit de chiromancie.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {partKeys.map((pk) => (
          <button
            key={pk}
            onClick={() => openSheet(parts[pk][0])}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${current.part === pk ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'}`}
          >
            {PART_TITLES[pk] || `Partie ${pk}`}
          </button>
        ))}
      </div>

      <div className="glass-card p-5">
        <p className="text-[11px] uppercase tracking-widest text-primary/70 mb-1">{PART_TITLES[current.part]}</p>
        <h2 className="font-display text-2xl mb-1">{current.sheet_title}</h2>
        {current.chapter && <p className="text-xs text-muted-foreground mb-4">{current.chapter}</p>}
        <div className="gold-divider mb-4" />
        <div className="prose-reading">
          <ReactMarkdown>{current.content}</ReactMarkdown>
        </div>
      </div>

      <div className="flex items-center justify-between mt-5">
        <button onClick={() => go(-1)} disabled={idx <= 0} className="btn-ghost-gold px-4 py-2 flex items-center gap-1 disabled:opacity-30">
          <ChevronLeft size={16} /> Précédent
        </button>
        <button onClick={markComplete} className="text-xs text-primary flex items-center gap-1">
          <Check size={14} /> Marquer lu
        </button>
        <button onClick={() => go(1)} disabled={idx >= courses.length - 1} className="btn-ghost-gold px-4 py-2 flex items-center gap-1 disabled:opacity-30">
          Suivant <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-4">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((progress?.completed_ids?.length || 0) / Math.max(courses.length, 1)) * 100}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          {progress?.completed_ids?.length || 0} / {courses.length} fiches lues
        </p>
      </div>
    </div>
  );
}