import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FolderOpenIcon, CalendarIcon, ArrowRightIcon, CpuIcon } from "lucide-react";
import { getProjects, createProject, updateProject, getProviderKeys, ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Provider = "openai" | "anthropic";

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

const PROVIDER_COLORS: Record<Provider, string> = {
  openai: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  anthropic: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

function useConfiguredProviders() {
  const { data: keys } = useQuery({
    queryKey: ["providerKeys"],
    queryFn: getProviderKeys,
  });

  const configured = new Set<string>();
  if (keys) {
    for (const k of keys) {
      configured.add(k.provider);
    }
  }

  return { configured, isLoaded: !!keys };
}

export function ProjectsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { configured, isLoaded: providersLoaded } = useConfiguredProviders();

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const createMutation = useMutation({
    mutationFn: () => createProject(name.trim(), provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setName("");
      setProvider("openai");
      setCreating(false);
      setFormError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const body = err.body as { error?: string };
        setFormError(body?.error ?? "Failed to create project");
      } else {
        setFormError("Failed to create project");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ projectId, newProvider }: { projectId: string; newProvider: Provider }) =>
      updateProject(projectId, newProvider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Provider updated");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const body = err.body as { error?: string };
        toast.error(body?.error ?? "Failed to update provider");
      } else {
        toast.error("Failed to update provider");
      }
    },
  });

  const handleStartCreating = () => {
    setCreating(true);
    setFormError(null);
    if (configured.size === 1) {
      setProvider([...configured][0] as Provider);
    } else {
      setProvider("openai");
    }
  };

  const noKeysConfigured = providersLoaded && configured.size === 0;
  const onlyOneProvider = providersLoaded && configured.size === 1;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Your Projects</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your memory projects and their LLM providers.
          </p>
        </div>
        <Button onClick={handleStartCreating}>
          New project
        </Button>
      </div>

      {creating && (
        <Card className="mb-8 border-primary/20">
          <CardContent>
            <form
              onSubmit={(e: FormEvent) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-4"
            >
              <p className="text-sm font-medium text-card-foreground">Create new project</p>
              {formError && (
                <div className="bg-destructive/10 text-destructive px-3 py-2 text-sm">
                  {formError}
                </div>
              )}
              {noKeysConfigured && (
                <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2 text-sm">
                  No provider keys configured.{" "}
                  <Link to="/settings" className="underline font-medium">
                    Add one in Settings
                  </Link>{" "}
                  first.
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Project name
                  </label>
                  <Input
                    autoFocus
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. My Assistant"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    LLM Provider
                  </label>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Choose which provider to use for fact extraction in this project.
                  </p>
                  <Select
                    value={provider}
                    onValueChange={(v) => setProvider(v as Provider)}
                    disabled={noKeysConfigured || onlyOneProvider}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["openai", "anthropic"] as const).map((p) => (
                        <SelectItem key={p} value={p} disabled={providersLoaded && !configured.has(p)}>
                          {PROVIDER_LABELS[p]}
                          {providersLoaded && !configured.has(p) ? " (no key)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {onlyOneProvider && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Only {PROVIDER_LABELS[[...configured][0] as Provider]} key is configured.{" "}
                      <Link to="/settings" className="underline">Add more in Settings</Link>.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={createMutation.isPending || !name.trim() || noKeysConfigured}>
                  {createMutation.isPending ? "Creating…" : "Create"}
                </Button>
                <Button variant="outline" type="button" onClick={() => { setCreating(false); setName(""); setFormError(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading projects…</div>
      )}

      {error && (
        <div className="text-sm text-destructive py-4">Failed to load projects.</div>
      )}

      {projects && projects.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpenIcon className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg mb-1">No projects yet</p>
          <p className="text-sm">Create your first project to get started.</p>
        </div>
      )}

      <ul className="space-y-3">
        {projects?.map((p) => {
          const prov = p.provider as Provider;
          return (
            <li key={p.id}>
              <Card className="group transition-all border-border/60 hover:border-border hover:shadow-md">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: project info */}
                    <Link
                      to="/projects/$projectId/workbench"
                      params={{ projectId: p.id }}
                      className="flex-1 min-w-0"
                    >
                      <p className="text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors">
                        {p.name}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarIcon className="size-3" />
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 ${PROVIDER_COLORS[prov]}`}>
                          <CpuIcon className="size-3" />
                          {PROVIDER_LABELS[prov]}
                        </span>
                      </div>
                    </Link>

                    {/* Right: provider switch + open */}
                    <div className="flex items-center gap-3 shrink-0 pt-0.5">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                          Provider
                        </span>
                        <Select
                          value={p.provider}
                          onValueChange={(v) => {
                            updateMutation.mutate({ projectId: p.id, newProvider: v as Provider });
                          }}
                          disabled={!providersLoaded || (configured.size < 2 && configured.has(p.provider))}
                        >
                          <SelectTrigger
                            className="w-28 h-7 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["openai", "anthropic"] as const).map((prov) => (
                              <SelectItem key={prov} value={prov} disabled={providersLoaded && !configured.has(prov)}>
                                {PROVIDER_LABELS[prov]}
                                {providersLoaded && !configured.has(prov) ? " (no key)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Link
                        to="/projects/$projectId/workbench"
                        params={{ projectId: p.id }}
                        className="flex items-center justify-center size-8 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <ArrowRightIcon className="size-4" />
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
