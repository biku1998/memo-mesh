import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { getProjects, createProject, logout, ApiError } from "../lib/api";

export function ProjectsPage() {
  const navigate = useNavigate();
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

  async function handleLogout() {
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Memo Mesh</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Your Projects</h2>
          <button
            onClick={() => { setCreating(true); setFormError(null); }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            New project
          </button>
        </div>

        {creating && (
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); createMutation.mutate(); }}
            className="mb-6 bg-white rounded-xl border border-gray-200 p-4 space-y-3"
          >
            <p className="text-sm font-medium text-gray-700">Create new project</p>
            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={createMutation.isPending || !name.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {isLoading && (
          <div className="text-sm text-gray-500 py-8 text-center">Loading projects…</div>
        )}

        {error && (
          <div className="text-sm text-red-600 py-4">Failed to load projects.</div>
        )}

        {projects && projects.length === 0 && (
          <div className="text-center py-12 text-gray-500">
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
                className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.provider} · Created {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-gray-100 text-gray-500 rounded px-2 py-1">
                    {p.apiKey.slice(0, 16)}…
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
