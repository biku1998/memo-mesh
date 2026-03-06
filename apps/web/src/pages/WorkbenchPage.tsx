import { useState, useEffect, useRef, type FormEvent } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  getProjects,
  getProjectApiKey,
  getMessages,
  getFactMemories,
  sendMessage,
  searchMemories,
  type FactMemory,
  type SearchMemoryItem,
  type ContextPack,
  type ContextPackFact,
} from "../lib/api";
import { ExplainDrawer } from "../components/ExplainDrawer";

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
    <Card size="sm" className="transition-colors hover:ring-foreground/20">
      <CardContent>
        <p className="text-sm text-card-foreground leading-relaxed">{fact.text}</p>
        <div className="mt-1.5 flex items-center gap-2">
          {fact.confidence != null && (
            <span className="text-xs text-muted-foreground">
              {(fact.confidence * 100).toFixed(0)}% conf
            </span>
          )}
          <Button variant="link" size="sm" className="ml-auto" onClick={() => onExplain(fact.memoryId)}>
            Explain →
          </Button>
        </div>
      </CardContent>
    </Card>
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
    <Card
      size="sm"
      className={`transition-colors ${
        isNew
          ? "ring-foreground/20 bg-accent"
          : "hover:ring-foreground/20"
      }`}
    >
      <CardContent>
        {isNew && (
          <span className="inline-block mb-1 text-xs font-medium text-foreground bg-accent px-1.5 py-0.5">
            New
          </span>
        )}
        <p className="text-sm text-card-foreground leading-relaxed">{fact.text}</p>
        <div className="mt-1.5 flex items-center gap-2">
          {fact.confidence != null && (
            <span className="text-xs text-muted-foreground">
              {(fact.confidence * 100).toFixed(0)}% conf
            </span>
          )}
          <span className="text-xs text-muted-foreground/50">·</span>
          <span className="text-xs text-muted-foreground">
            {new Date(fact.createdAt).toLocaleDateString()}
          </span>
          <Button variant="link" size="sm" className="ml-auto" onClick={() => onExplain(fact.memoryId)}>
            Explain →
          </Button>
        </div>
      </CardContent>
    </Card>
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
            <label htmlFor="role-select" className="text-xs text-gray-400">Role</label>
            <div className="w-32">
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger id="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="assistant">Assistant</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message to ingest…"
            rows={4}
            className="resize-none"
          />
          {sendMutation.error && (
            <p className="text-xs text-red-500">Failed to send message.</p>
          )}
          <Button type="submit" disabled={sendMutation.isPending || !content.trim()} className="w-full">
            {sendMutation.isPending ? "Sending…" : "Send & Extract"}
          </Button>
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
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories…"
            className="flex-1"
          />
          <Button type="submit" disabled={isFetching || !query.trim()}>
            {isFetching ? "…" : "Search"}
          </Button>
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
        <Button variant="link" size="sm" className="ml-auto" onClick={() => onExplain(item.memoryId)}>
          Explain →
        </Button>
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
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="border-b border-border px-5 py-3 flex items-center gap-3 shrink-0">
        <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-xs font-semibold text-foreground">{project.name}</h1>
        <div className="ml-auto flex items-center gap-4">
          <Link
            to="/projects/$projectId/memories"
            params={{ projectId: project.id }}
            className="text-xs text-muted-foreground hover:text-foreground font-medium"
          >
            Memories →
          </Link>
          <Link
            to="/projects/$projectId/graph"
            params={{ projectId: project.id }}
            className="text-xs text-muted-foreground hover:text-foreground font-medium"
          >
            Knowledge Graph →
          </Link>
        </div>
      </header>

      {/* Split panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — 40% */}
        <div className="w-2/5 border-r border-border bg-card overflow-hidden">
          <IngestPanel
            projectId={project.id}
            apiKey={apiKey}
            onExplain={setExplainMemoryId}
          />
        </div>

        {/* Right — 60% */}
        <div className="w-3/5 bg-card overflow-hidden">
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
          onClose={() => setExplainMemoryId(null)}
        />
      )}
    </div>
  );
}
