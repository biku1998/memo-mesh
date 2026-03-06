import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmationInput {
  label: string;
  value: string;
}

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  warning?: string;
  confirmations?: ConfirmationInput[];
  onConfirm: () => void;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  warning,
  confirmations,
  onConfirm,
}: ConfirmationDialogProps) {
  const [inputs, setInputs] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setInputs(confirmations ? confirmations.map(() => "") : []);
    }
  }, [open, confirmations]);

  const allConfirmed =
    !confirmations ||
    confirmations.every((c, i) => inputs[i] === c.value);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-0 p-0 overflow-hidden">
        {/* Header */}
        <AlertDialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Confirmation inputs */}
        {confirmations && confirmations.length > 0 && (
          <div className="px-6 py-4 border-b border-border space-y-4">
            {confirmations.map((c, i) => (
              <div key={i}>
                <label htmlFor={`confirm-${i}`} className="block text-sm text-muted-foreground mb-1.5">
                  To confirm, type &ldquo;<span className="font-semibold text-foreground">{c.value}</span>&rdquo;
                </label>
                <Input
                  id={`confirm-${i}`}
                  type="text"
                  value={inputs[i] ?? ""}
                  onChange={(e) => {
                    const next = [...inputs];
                    next[i] = e.target.value;
                    setInputs(next);
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Warning banner */}
        {warning && (
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {warning}
            </div>
          </div>
        )}

        {/* Actions */}
        <AlertDialogFooter className="px-6 py-4 flex-row items-center justify-between sm:justify-between">
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant === "danger" ? "destructive" : "default"}
            disabled={!allConfirmed}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
