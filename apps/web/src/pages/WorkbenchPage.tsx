import { useState, useEffect, useRef, type FormEvent } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select } from "../components/Select";
import {
  getProjects,
  getProjectApiKey,
  getMessages,
  getFactMemories,
  sendMessage,
  searchMemories,
  explainMemory,
  type FactMemory,
  type SearchMemoryItem,
  type ContextPack,
  type ContextPackFact,
  type ExplainResponse,
} from "../lib/api";

// ──────────────────────────────────────────────────────
// Explain Drawer
// ──────────────────────────────────────────────────────

function ExplainDrawer({
  memoryId,
  projectId,
  apiKey,
  onClose,
}: {
  memoryId: string;
  projectId: string;
  apiKey: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["explain", projectId, memoryId],
    queryFn: () => explainMemory(projectId, apiKey, memoryId),
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
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-gray-200 shadow-xl z-50 overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Memory Provenance</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
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

function StatusBadge({ status }: { status: string }) {
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

// ──────────────────────────────────────────────────────
// Fact Card (reused in both panels)
// ──────────────────────────────────────────────────────

function FactCard({
  fact,
  onExplain,
}: {
  fact: ContextPackFact;
  onExplain: (memoryId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 hover:border-indigo-300 transition-colors">
      <p className="text-sm text-gray-800 leading-relaxed">{fact.text}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {fact.confidence != null && (
          <span className="text-xs text-gray-400">
            {(fact.confidence * 100).toFixed(0)}% conf
          </span>
        )}
        <button
          onClick={() => onExplain(fact.memoryId)}
          className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
        >
          Explain →
        </button>
      </div>
    </div>
  );
}

function FactMemoryCard({
  fact,
  isNew,
  onExplain,
}: {
  fact: FactMemory;
  isNew: boolean;
  onExplain: (memoryId: string) => void;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 transition-colors ${
        isNew
          ? "border-indigo-300 bg-indigo-50"
          : "border-gray-200 bg-white hover:border-indigo-300"
      }`}
    >
      {isNew && (
        <span className="inline-block mb-1 text-xs font-medium text-indigo-600 bg-indigo-100 rounded px-1.5 py-0.5">
          New
        </span>
      )}
      <p className="text-sm text-gray-800 leading-relaxed">{fact.text}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {fact.confidence != null && (
          <span className="text-xs text-gray-400">
            {(fact.confidence * 100).toFixed(0)}% conf
          </span>
        )}
        <span className="text-xs text-gray-300">·</span>
        <span className="text-xs text-gray-400">
          {new Date(fact.createdAt).toLocaleDateString()}
        </span>
        <button
          onClick={() => onExplain(fact.memoryId)}
          className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
        >
          Explain →
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Left Panel — Ingest
// ──────────────────────────────────────────────────────

function IngestPanel({
  projectId,
  apiKey,
  onExplain,
}: {
  projectId: string;
  apiKey: string;
  onExplain: (memoryId: string) => void;
}) {
  const [content, setContent] = useState("");
  const [role, setRole] = useState<"user" | "assistant" | "system">("user");
  const [polling, setPolling] = useState(false);
  // Tracks newly extracted fact IDs from the most recent send (for highlighting)
  const [newFactIds, setNewFactIds] = useState<Set<string>>(new Set());
  const qc = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFactCountRef = useRef<number | null>(null);
  // Snapshot of fact IDs at send time — avoids stale closure inside the interval
  const prevFactIdsRef = useRef<Set<string>>(new Set());

  // Load persisted messages from DB
  const { data: messages } = useQuery({
    queryKey: ["messages", projectId],
    queryFn: () => getMessages(projectId, apiKey, 20),
  });

  // Load persisted facts from DB
  const { data: facts } = useQuery({
    queryKey: ["facts", projectId],
    queryFn: () => getFactMemories(projectId, apiKey, 50),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendMessage(projectId, apiKey, role, content.trim()),
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["messages", projectId] });
      // Snapshot current fact IDs into a ref so the interval doesn't close over
      // the stale `facts` React state variable.
      prevFactCountRef.current = facts?.length ?? 0;
      prevFactIdsRef.current = new Set((facts ?? []).map((f) => f.memoryId));
      setNewFactIds(new Set());
      // Clear any existing interval before starting a new one
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setPolling(true);
      const deadline = Date.now() + 15_000;
      pollRef.current = setInterval(async () => {
        try {
          const refreshed = await qc.fetchQuery({
            queryKey: ["facts", projectId],
            queryFn: () => getFactMemories(projectId, apiKey, 50),
          });
          // If new facts appeared, mark them and stop polling
          if (refreshed.length > (prevFactCountRef.current ?? 0)) {
            const freshIds = new Set(
              refreshed.filter((f) => !prevFactIdsRef.current.has(f.memoryId)).map((f) => f.memoryId),
            );
            setNewFactIds(freshIds);
            clearInterval(pollRef.current!);
            setPolling(false);
          } else if (Date.now() >= deadline) {
            clearInterval(pollRef.current!);
            setPolling(false);
          }
        } catch {
          clearInterval(pollRef.current!);
          setPolling(false);
        }
      }, 2000);
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    sendMutation.mutate();
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Ingest Message</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Input form */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex gap-2 items-center">
            <div className="w-32">
              <Select
                value={role}
                onValueChange={(v) => setRole(v as typeof role)}
                options={[
                  { value: "user", label: "User" },
                  { value: "assistant", label: "Assistant" },
                  { value: "system", label: "System" },
                ]}
              />
            </div>
            <span className="text-xs text-gray-400">Role</span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message to ingest…"
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {sendMutation.error && (
            <p className="text-xs text-red-500">Failed to send message.</p>
          )}
          <button
            type="submit"
            disabled={sendMutation.isPending || !content.trim()}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {sendMutation.isPending ? "Sending…" : "Send & Extract"}
          </button>
        </form>

        {/* Extracted facts from DB */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Extracted Facts
            </p>
            {polling && (
              <span className="text-xs text-indigo-500 animate-pulse">Extracting…</span>
            )}
            {facts && facts.length > 0 && (
              <span className="ml-auto text-xs text-gray-400">{facts.length} total</span>
            )}
          </div>
          {(!facts || facts.length === 0) && !polling && (
            <p className="text-xs text-gray-400">No facts yet — send a message to extract.</p>
          )}
          {polling && (!facts || facts.length === 0) && (
            <p className="text-xs text-gray-400">Waiting for LLM extraction (up to 15s)…</p>
          )}
          <div className="space-y-2">
            {facts?.map((f) => (
              <FactMemoryCard
                key={f.memoryId}
                fact={f}
                isNew={newFactIds.has(f.memoryId)}
                onExplain={onExplain}
              />
            ))}
          </div>
        </div>

        {/* Message history from DB */}
        {messages && messages.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Recent Messages
            </p>
            <ul className="space-y-2">
              {messages.map((m) => (
                <li key={m.id} className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                  <p className="text-xs text-gray-400 mb-0.5 capitalize">
                    {m.role} · {new Date(m.createdAt).toLocaleTimeString()}
                  </p>
                  <p className="text-sm text-gray-700 line-clamp-2">{m.content}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Right Panel — Search + Context Pack
// ──────────────────────────────────────────────────────

function SearchPanel({
  projectId,
  apiKey,
  onExplain,
}: {
  projectId: string;
  apiKey: string;
  onExplain: (memoryId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isFetching, error } = useQuery({
    queryKey: ["search", projectId, submitted],
    queryFn: () => searchMemories(projectId, apiKey, submitted),
    enabled: submitted.length > 0,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSubmitted(query.trim());
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Semantic Search</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories…"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isFetching || !query.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isFetching ? "…" : "Search"}
          </button>
        </form>

        {error && <p className="text-sm text-red-500">Search failed.</p>}

        {data && (
          <>
            {/* Ranked items */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Results ({data.items.length})
              </p>
              {data.items.length === 0 && (
                <p className="text-sm text-gray-400">No results found.</p>
              )}
              <ul className="space-y-2">
                {data.items.map((item) => (
                  <SearchResultItem key={item.memoryId} item={item} onExplain={onExplain} />
                ))}
              </ul>
            </div>

            {/* Context Pack */}
            {data.contextPack.totalFacts > 0 && (
              <ContextPackSection pack={data.contextPack} onExplain={onExplain} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SearchResultItem({
  item,
  onExplain,
}: {
  item: SearchMemoryItem;
  onExplain: (id: string) => void;
}) {
  return (
    <li className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 hover:border-indigo-300 transition-colors">
      <p className="text-sm text-gray-800 leading-relaxed">{item.text}</p>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
        <span className="bg-gray-100 rounded px-1.5 py-0.5">{item.type}</span>
        <span title="Final score">{(item.finalScore * 100).toFixed(0)}%</span>
        <span title="Similarity">{(item.similarity * 100).toFixed(0)}% sim</span>
        <button
          onClick={() => onExplain(item.memoryId)}
          className="ml-auto text-indigo-500 hover:text-indigo-700 hover:underline"
        >
          Explain →
        </button>
      </div>
    </li>
  );
}

function ContextPackSection({
  pack,
  onExplain,
}: {
  pack: ContextPack;
  onExplain: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Context Pack
      </p>
      <p className="text-sm text-gray-600 mb-3">{pack.summary}</p>

      <div className="space-y-3">
        {pack.entities.map((entity) => (
          <div key={entity.entityId} className="rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [entity.entityId]: !prev[entity.entityId] }))}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm font-medium text-gray-800">
                {entity.name}
                <span className="ml-2 text-xs font-normal text-gray-400">{entity.kind}</span>
              </span>
              <span className="text-xs text-gray-400">
                {entity.facts.length} fact{entity.facts.length !== 1 ? "s" : ""}
                <span className="ml-2">{expanded[entity.entityId] ? "▲" : "▼"}</span>
              </span>
            </button>
            {expanded[entity.entityId] && (
              <div className="px-3 py-2 space-y-2">
                {entity.facts.map((f) => (
                  <FactCard key={f.memoryId} fact={f} onExplain={onExplain} />
                ))}
              </div>
            )}
          </div>
        ))}

        {pack.unattachedFacts.length > 0 && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, __unattached: !prev.__unattached }))}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm font-medium text-gray-600">Other facts</span>
              <span className="text-xs text-gray-400">
                {pack.unattachedFacts.length} fact{pack.unattachedFacts.length !== 1 ? "s" : ""}
                <span className="ml-2">{expanded.__unattached ? "▲" : "▼"}</span>
              </span>
            </button>
            {expanded.__unattached && (
              <div className="px-3 py-2 space-y-2">
                {pack.unattachedFacts.map((f) => (
                  <FactCard key={f.memoryId} fact={f} onExplain={onExplain} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Workbench Page
// ──────────────────────────────────────────────────────

export function WorkbenchPage() {
  const { projectId } = useParams({ from: "/protected/projects/$projectId/workbench" });
  const [explainMemoryId, setExplainMemoryId] = useState<string | null>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  // Fetch API key separately — not included in the list response
  const { data: keyData, isLoading: keyLoading } = useQuery({
    queryKey: ["project-api-key", projectId],
    queryFn: () => getProjectApiKey(projectId),
  });

  const project = projects?.find((p) => p.id === projectId);
  const apiKey = keyData?.apiKey;

  if (projectsLoading || keyLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!project || !apiKey) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-red-500">
        Project not found.{" "}
        <Link to="/projects" className="ml-2 text-indigo-500 underline">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 shrink-0">
        <Link to="/projects" className="text-sm text-gray-400 hover:text-gray-600">
          ← Projects
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-sm font-semibold text-gray-900">{project.name}</h1>
        <Link
          to="/projects/$projectId/graph"
          params={{ projectId: project.id }}
          className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 font-medium"
        >
          Knowledge Graph →
        </Link>
      </header>

      {/* Split panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — 40% */}
        <div className="w-2/5 border-r border-gray-200 bg-white overflow-hidden">
          <IngestPanel
            projectId={project.id}
            apiKey={apiKey}
            onExplain={setExplainMemoryId}
          />
        </div>

        {/* Right — 60% */}
        <div className="w-3/5 bg-white overflow-hidden">
          <SearchPanel
            projectId={project.id}
            apiKey={apiKey}
            onExplain={setExplainMemoryId}
          />
        </div>
      </div>

      {/* Explain Drawer */}
      {explainMemoryId && (
        <ExplainDrawer
          memoryId={explainMemoryId}
          projectId={project.id}
          apiKey={apiKey}
          onClose={() => setExplainMemoryId(null)}
        />
      )}
    </div>
  );
}
