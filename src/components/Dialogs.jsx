import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Confirmer",
  description = "",
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  loading = false,
  onConfirm,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[90vw] rounded-2xl border-border bg-card text-card-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl text-primary">{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel
            disabled={loading}
            className="rounded-full border-border text-muted-foreground hover:bg-secondary"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm?.(); }}
            disabled={loading}
            className={`rounded-full ${destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:brightness-110"}`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ErrorDialog({ open, onOpenChange, title = "Une erreur est survenue", description = "" }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[90vw] rounded-2xl border-border bg-card text-card-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl text-destructive">{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="rounded-full bg-primary text-primary-foreground hover:brightness-110">
            Fermer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}