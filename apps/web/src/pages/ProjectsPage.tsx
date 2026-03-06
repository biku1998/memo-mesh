import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getProjects, createProject, ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function ProjectsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const createMutation = useMutation({
    mutationFn: () => createProject(name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setName("");
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

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Your Projects</h2>
        <Button onClick={() => { setCreating(true); setFormError(null); }}>
          New project
        </Button>
      </div>

      {creating && (
        <Card className="mb-6">
          <CardContent>
            <form
              onSubmit={(e: FormEvent) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-3"
            >
              <p className="text-sm font-medium text-card-foreground">Create new project</p>
              {formError && (
                <div className="bg-destructive/10 text-destructive px-3 py-2 text-sm">
                  {formError}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  autoFocus
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                  className="flex-1"
                />
                <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
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
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-1">No projects yet</p>
          <p className="text-sm">Create your first project to get started.</p>
        </div>
      )}

      <ul className="space-y-3">
        {projects?.map((p) => (
          <li key={p.id}>
            <Link
              to="/projects/$projectId/workbench"
              params={{ projectId: p.id }}
              className="block"
            >
              <Card className="transition-all hover:ring-foreground/20 hover:shadow-sm">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.provider} · Created {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1">
                      Open →
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
