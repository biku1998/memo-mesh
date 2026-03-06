import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { explainMemoryDashboard, type ExplainResponse } from "../lib/api";

export function StatusBadge({ status }: { status: string }) {
  const isSuperseded = status === "superseded";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isSuperseded
          ? "bg-amber-50 text-amber-700 border border-amber-200"
          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
      }`}
    >
      {status}
    </span>
  );
}

function ExplainContent({ data }: { data: ExplainResponse }) {
  const { memory, evidence, entityMentions, similarMemories } = data;

  return (
    <>
      {/* Memory */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Memory</p>
        <p className="text-sm text-gray-900 leading-relaxed">{memory.text}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge status={memory.status} />
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {memory.type}
          </span>
          {memory.confidence != null && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
              {(memory.confidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
      </section>

      {/* Evidence */}
      {evidence && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Source Message</p>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">
              <span className="font-medium capitalize">{evidence.role}</span> ·{" "}
              {new Date(evidence.createdAt).toLocaleString()}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{evidence.content}</p>
          </div>
        </section>
      )}

      {/* Entity Mentions */}
      {entityMentions.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Entities</p>
          <div className="flex flex-wrap gap-2">
            {entityMentions.map((m) => (
              <span
                key={m.entityId}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700"
              >
                {m.name}
                <span className="text-indigo-400">{m.kind}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Similar / Consolidation */}
      {similarMemories.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Similar Memories (consolidation history)
          </p>
          <ul className="space-y-2">
            {similarMemories.map((s) => (
              <li key={s.memoryId} className="rounded-lg border border-gray-200 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-700 leading-relaxed">{s.text}</p>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {(s.similarity * 100).toFixed(0)}% similar
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function ExplainDrawer({
  memoryId,
  projectId,
  onClose,
}: {
  memoryId: string;
  projectId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["explain", projectId, memoryId],
    queryFn: () => explainMemoryDashboard(projectId, memoryId),
  });

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close drawer"
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(); }}
      />
      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="explain-drawer-title"
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-gray-200 shadow-xl z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="explain-drawer-title" className="text-sm font-semibold text-gray-900">Memory Provenance</h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {error && <p className="text-sm text-red-500">Failed to load provenance.</p>}
          {data && <ExplainContent data={data} />}
        </div>
      </div>
    </>
  );
}
