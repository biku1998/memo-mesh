import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getProjects, getProjectApiKey, getMemories } from "../lib/api";
import { ExplainDrawer, StatusBadge } from "../components/ExplainDrawer";

export function MemoryExplorerPage() {
  const { projectId } = useParams({ from: "/protected/projects/$projectId/memories" });
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [explainMemoryId, setExplainMemoryId] = useState<string | null>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const { data: keyData } = useQuery({
    queryKey: ["project-api-key", projectId],
    queryFn: () => getProjectApiKey(projectId),
  });

  const project = projects?.find((p) => p.id === projectId);
  const apiKey = keyData?.apiKey ?? "";

  const type = typeFilter === "all" ? undefined : typeFilter;
  const status = statusFilter === "all" ? undefined : statusFilter;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["memories", projectId, typeFilter, statusFilter],
    queryFn: ({ pageParam }) =>
      getMemories(projectId, {
        type,
        status,
        cursor: pageParam ?? undefined,
        limit: 30,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    initialPageParam: null as string | null,
  });

  const allMemories = data?.pages.flatMap((p) => p.memories) ?? [];

  if (projectsLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        Project not found.{" "}
        <Link to="/projects" className="ml-2 text-foreground underline">
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
        <Link
          to="/projects/$projectId/workbench"
          params={{ projectId: project.id }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {project.name}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-xs font-semibold text-foreground">Memory Explorer</h1>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/projects/$projectId/graph"
            params={{ projectId: project.id }}
            className="text-xs text-muted-foreground hover:text-foreground font-medium"
          >
            Knowledge Graph →
          </Link>
        </div>
      </header>

      {/* Filter bar */}
      <div className="border-b border-border px-5 py-3 flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <div className="w-32">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="fact">Fact</SelectItem>
              <SelectItem value="raw">Raw</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="superseded">Superseded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {allMemories.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{allMemories.length} loaded</span>
        )}
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {!isLoading && allMemories.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
            No memories yet.
          </div>
        )}

        {allMemories.map((memory) => (
          <Card key={memory.memoryId} size="sm" className="hover:ring-foreground/20 transition-colors">
            <CardContent>
              <p className="text-sm text-card-foreground leading-relaxed line-clamp-2">{memory.text}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={memory.status} />
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {memory.type}
                </span>
                {memory.confidence != null && (
                  <span className="text-xs text-muted-foreground">
                    {(memory.confidence * 100).toFixed(0)}% conf
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(memory.createdAt).toLocaleDateString()}
                </span>
                <Button
                  variant="link"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setExplainMemoryId(memory.memoryId)}
                >
                  Explain →
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {hasNextPage && (
          <div className="pt-2 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>

      {/* Explain Drawer */}
      {explainMemoryId && apiKey && (
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
