import { useState, useEffect } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

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

  const isDanger = variant === "danger";

  const confirmBtnClass = isDanger
    ? "bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300 disabled:hover:bg-red-300"
    : "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:hover:bg-indigo-300";

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 flex items-center justify-center data-[state=open]:animate-[fadeIn_150ms_ease-out] data-[state=closed]:animate-[fadeOut_100ms_ease-in]">
          <AlertDialog.Content className="w-full max-w-lg rounded-xl bg-gray-50 shadow-xl focus:outline-none overflow-hidden data-[state=open]:animate-[contentIn_150ms_ease-out] data-[state=closed]:animate-[contentOut_100ms_ease-in]">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-200">
              <AlertDialog.Title className="text-lg font-semibold text-gray-900">
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm text-gray-500 leading-relaxed">
                {description}
              </AlertDialog.Description>
            </div>

            {/* Confirmation inputs */}
            {confirmations && confirmations.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-200 space-y-4">
                {confirmations.map((c, i) => (
                  <div key={i}>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      To confirm, type &ldquo;<span className="font-semibold">{c.value}</span>&rdquo;
                    </label>
                    <input
                      type="text"
                      value={inputs[i] ?? ""}
                      onChange={(e) => {
                        const next = [...inputs];
                        next[i] = e.target.value;
                        setInputs(next);
                      }}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Warning banner */}
            {warning && (
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <WarningIcon />
                  {warning}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-6 py-4 flex items-center justify-between">
              <AlertDialog.Cancel className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1">
                {cancelLabel}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                disabled={!allConfirmed}
                onClick={onConfirm}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed ${confirmBtnClass}`}
              >
                {confirmLabel}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M8 5v3m0 2.5h.007M14 8A6 6 0 112 8a6 6 0 0112 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
