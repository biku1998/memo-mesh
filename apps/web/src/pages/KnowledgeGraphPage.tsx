import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import cytoscape from "cytoscape";
import {
  getProjects,
  getProjectApiKey,
  getGraph,
  getEntityDetail,
} from "../lib/api";
import { Button } from "../components/Button";

// Color palette by entity kind
const KIND_COLORS: Record<string, string> = {
  person: "#6366f1",
  organization: "#f59e0b",
  product: "#10b981",
  technology: "#3b82f6",
  location: "#ef4444",
  concept: "#8b5cf6",
  event: "#ec4899",
};
const DEFAULT_COLOR = "#6b7280";

function getKindColor(kind: string): string {
  return KIND_COLORS[kind.toLowerCase()] ?? DEFAULT_COLOR;
}

// ── Entity Detail Side Panel ────────────────────────────

function EntityPanel({
  projectId,
  apiKey,
  entityId,
  onClose,
  onNavigate,
}: {
  projectId: string;
  apiKey: string;
  entityId: string;
  onClose: () => void;
  onNavigate: (entityId: string) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["entity-detail", projectId, apiKey, entityId],
    queryFn: () => getEntityDetail(projectId, apiKey, entityId),
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (isLoading) {
    return (
      <div className="p-5 text-sm text-gray-500">Loading entity details…</div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5 text-sm text-red-500">Failed to load entity.</div>
    );
  }

  const { entity, relations, mentions } = data;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{entity.name}</h2>
          <span
            className="inline-block mt-1 text-xs font-medium rounded-full px-2 py-0.5 text-white"
            style={{ backgroundColor: getKindColor(entity.kind) }}
          >
            {entity.kind}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          ×
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm">
        {/* Outgoing relations */}
        {relations.outgoing.length > 0 && (
          <Section title="Outgoing relations">
            {relations.outgoing.map((r) => (
              <div key={r.id}>
                <RelationRow>
                  <span className="text-gray-500">{r.predicate}</span>
                  <span className="mx-1 text-gray-300">→</span>
                  <Button variant="link" size="sm" onClick={() => r.target && onNavigate(r.target.id)}>
                    {r.target?.name}
                  </Button>
                  <ConfidenceBadge value={r.confidence} />
                </RelationRow>
                {r.evidence && <EvidenceSnippet text={r.evidence.text} type={r.evidence.type} />}
              </div>
            ))}
          </Section>
        )}

        {/* Incoming relations */}
        {relations.incoming.length > 0 && (
          <Section title="Incoming relations">
            {relations.incoming.map((r) => (
              <div key={r.id}>
                <RelationRow>
                  <Button variant="link" size="sm" onClick={() => r.source && onNavigate(r.source.id)}>
                    {r.source?.name}
                  </Button>
                  <span className="mx-1 text-gray-300">→</span>
                  <span className="text-gray-500">{r.predicate}</span>
                  <ConfidenceBadge value={r.confidence} />
                </RelationRow>
                {r.evidence && <EvidenceSnippet text={r.evidence.text} type={r.evidence.type} />}
              </div>
            ))}
          </Section>
        )}

        {/* Evidence mentions */}
        {mentions.length > 0 && (
          <Section title="Evidence memories">
            <ul className="space-y-2">
              {mentions.map((m) => (
                <li
                  key={m.memoryId}
                  className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-700"
                >
                  <p>{m.text}</p>
                  <p className="text-gray-400 mt-1">
                    {m.type} · {new Date(m.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {relations.outgoing.length === 0 &&
          relations.incoming.length === 0 &&
          mentions.length === 0 && (
            <p className="text-gray-400 text-center py-6">
              No relations or mentions found for this entity.
            </p>
          )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function RelationRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1 py-1 text-sm">{children}</div>;
}

function ConfidenceBadge({ value }: { value: number }) {
  return (
    <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
      {Math.round(value * 100)}%
    </span>
  );
}

function EvidenceSnippet({ text, type }: { text: string; type: string }) {
  return (
    <p className="ml-4 mb-1 text-[11px] text-gray-400 italic truncate" title={text}>
      {type}: {text}
    </p>
  );
}

// ── Legend ───────────────────────────────────────────────

function Legend({ kinds }: { kinds: string[] }) {
  if (kinds.length === 0) return null;
  return (
    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg border border-gray-200 px-3 py-2 flex flex-wrap gap-3 text-xs z-10">
      {kinds.map((kind) => (
        <span key={kind} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: getKindColor(kind) }}
          />
          <span className="text-gray-600 capitalize">{kind}</span>
        </span>
      ))}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────

export function KnowledgeGraphPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const project = projects?.find((p) => p.id === projectId);

  const { data: apiKeyData } = useQuery({
    queryKey: ["apiKey", projectId],
    queryFn: () => getProjectApiKey(projectId),
    enabled: !!project,
  });

  const apiKey = apiKeyData?.apiKey ?? "";

  const { data: graphData, isLoading, error } = useQuery({
    queryKey: ["graph", projectId, apiKey],
    queryFn: () => getGraph(projectId, apiKey, 200),
    enabled: !!apiKey,
  });

  // Unique kinds for the legend
  const kinds = graphData
    ? [...new Set(graphData.nodes.map((n) => n.kind.toLowerCase()))]
    : [];

  // Build and render Cytoscape graph
  const buildGraph = useCallback(() => {
    if (!containerRef.current || !graphData) return;

    // Destroy previous instance
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const elements: cytoscape.ElementDefinition[] = [];

    // Nodes
    for (const node of graphData.nodes) {
      elements.push({
        data: {
          id: node.id,
          label: node.name,
          kind: node.kind.toLowerCase(),
          color: getKindColor(node.kind),
        },
      });
    }

    // Edges — only add if both endpoints exist
    const nodeIds = new Set(graphData.nodes.map((n) => n.id));
    for (const edge of graphData.edges) {
      if (nodeIds.has(edge.subjectEntityId) && nodeIds.has(edge.objectEntityId)) {
        elements.push({
          data: {
            id: edge.id,
            source: edge.subjectEntityId,
            target: edge.objectEntityId,
            label: edge.predicate,
          },
        });
      }
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "data(color)",
            color: "#374151",
            "font-size": "11px",
            "text-valign": "bottom",
            "text-margin-y": 6,
            width: 32,
            height: 32,
            "border-width": 0,
            "text-max-width": "80px",
            "text-wrap": "ellipsis",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#4f46e5",
          },
        },
        {
          selector: "edge",
          style: {
            label: "data(label)",
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            "line-color": "#d1d5db",
            "target-arrow-color": "#d1d5db",
            "font-size": "9px",
            color: "#9ca3af",
            "text-rotation": "autorotate",
            width: 1.5,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 500,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        gravity: 0.3,
        padding: 40,
      } as cytoscape.CoseLayoutOptions,
      minZoom: 0.3,
      maxZoom: 3,
    });

    cy.on("tap", "node", (evt) => {
      const nodeId = evt.target.id();
      setSelectedEntityId(nodeId);
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        setSelectedEntityId(null);
      }
    });

    cyRef.current = cy;
  }, [graphData]);

  useEffect(() => {
    buildGraph();
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [buildGraph]);

  // Navigate to an entity in the side panel + highlight on graph
  const handleNavigateEntity = useCallback((entityId: string) => {
    setSelectedEntityId(entityId);
    if (cyRef.current) {
      const node = cyRef.current.getElementById(entityId);
      if (node.length) {
        cyRef.current.animate({
          center: { eles: node },
          zoom: 1.5,
        } as cytoscape.AnimateOptions);
        cyRef.current.elements().unselect();
        node.select();
      }
    }
  }, []);

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">
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
        <Link
          to="/projects/$projectId/workbench"
          params={{ projectId }}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          {project.name}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-sm font-semibold text-gray-900">Knowledge Graph</h1>

        {graphData && (
          <span className="ml-auto text-xs text-gray-400">
            {graphData.nodes.length} entities · {graphData.edges.length} relations
          </span>
        )}
      </header>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph area */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
              Loading graph…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-red-500">
              Failed to load graph data.
            </div>
          )}
          {graphData && graphData.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-sm">
              <p className="text-lg mb-1">No entities yet</p>
              <p>Send some messages in the workbench to populate the graph.</p>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
          <Legend kinds={kinds} />
        </div>

        {/* Side panel */}
        {selectedEntityId && apiKey && (
          <div className="w-80 border-l border-gray-200 bg-white overflow-hidden">
            <EntityPanel
              projectId={projectId}
              apiKey={apiKey}
              entityId={selectedEntityId}
              onClose={() => setSelectedEntityId(null)}
              onNavigate={handleNavigateEntity}
            />
          </div>
        )}
      </div>
    </div>
  );
}
