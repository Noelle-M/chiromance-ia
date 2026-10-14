import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Hand, Heart, BookOpen, User } from "lucide-react";

const tabs = [
  { to: "/", label: "Accueil", icon: Home, end: true },
  { to: "/mes-mains", label: "Mes mains", icon: Hand },
  { to: "/compatibilite", label: "Compatibilité", icon: Heart },
  { to: "/apprendre", label: "Apprendre", icon: BookOpen },
  { to: "/mon-compte", label: "Mon compte", icon: User },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md flex items-stretch justify-around">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.6} className={isActive ? "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]" : ""} />
                <span className="font-body tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}