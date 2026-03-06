import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getProviderKeys, upsertProviderKey, deleteProviderKey, ApiError } from "../lib/api";
import { Select } from "../components/Select";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { toast } from "sonner";

const PROVIDERS = ["openai", "anthropic"] as const;
type Provider = (typeof PROVIDERS)[number];

export function SettingsPage() {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: keys, isLoading, error } = useQuery({
    queryKey: ["provider-keys"],
    queryFn: getProviderKeys,
    retry: false,
  });

  const serverUnavailable =
    error instanceof ApiError && error.status === 503;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await upsertProviderKey(provider, apiKey.trim());
      await qc.invalidateQueries({ queryKey: ["provider-keys"] });
      setApiKey("");
      setSaveSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { error?: string };
        if (err.status === 503) {
          setSaveError("Server is not configured for key storage (KEY_ENCRYPTION_SECRET missing).");
        } else {
          setSaveError(body?.error ?? "Failed to save key.");
        }
      } else {
        setSaveError("Failed to save key.");
      }
    } finally {
      setSaving(false);
    }
  }

  const [deleting, setDeleting] = useState<Provider | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Provider | null>(null);

  async function handleDelete(p: Provider) {
    setDeleting(p);
    setConfirmDelete(null);
    try {
      await deleteProviderKey(p);
      await qc.invalidateQueries({ queryKey: ["provider-keys"] });
      toast.success(`${p} API key removed successfully.`);
    } catch {
      toast.error(`Failed to remove ${p} key.`);
    } finally {
      setDeleting(null);
    }
  }

  const getKeyInfo = (p: Provider) => keys?.find((k) => k.provider === p);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/projects" className="text-lg font-semibold text-gray-900 hover:text-indigo-600">
            Memo Mesh
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-600">Settings</span>
        </div>
        <Link
          to="/projects"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Back to projects
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Provider API Keys</h2>
          <p className="mt-1 text-sm text-gray-500">
            Keys are encrypted at rest. Only masked values are shown after saving.
          </p>
        </div>

        {serverUnavailable && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Key storage is unavailable — <code className="font-mono">KEY_ENCRYPTION_SECRET</code> is not
            configured on the server. Set it in your environment and restart the API.
          </div>
        )}

        {/* Current keys status */}
        {!serverUnavailable && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {PROVIDERS.map((p) => {
              const info = getKeyInfo(p);
              return (
                <div key={p} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">{p}</p>
                    {isLoading ? (
                      <p className="text-xs text-gray-400 mt-0.5">Loading…</p>
                    ) : info ? (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        {info.maskedKey}
                        <span className="font-sans ml-2 text-gray-300">·</span>
                        <span className="font-sans ml-2">
                          Updated {new Date(info.updatedAt).toLocaleDateString()}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">Not configured</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {info && (
                      <button
                        onClick={() => setConfirmDelete(p)}
                        disabled={deleting === p}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                      >
                        {deleting === p ? "Removing…" : "Remove"}
                      </button>
                    )}
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                        info
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {info ? "Configured" : "Not set"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Set / update key form */}
        {!serverUnavailable && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                {getKeyInfo(provider) ? "Update a provider key" : "Set a provider key"}
              </h3>
              {getKeyInfo(provider) && (
                <p className="text-xs text-amber-600 mt-1">
                  A key already exists for {provider}. Saving will replace it.
                </p>
              )}
            </div>

            {saveSuccess && (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                Key saved successfully.
              </div>
            )}
            {saveError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {saveError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-3">
                <div className="w-40">
                  <label htmlFor="provider" className="block text-xs font-medium text-gray-600 mb-1">
                    Provider
                  </label>
                  <Select
                    id="provider"
                    value={provider}
                    onValueChange={(v) => {
                      setProvider(v as Provider);
                      setSaveSuccess(false);
                      setSaveError(null);
                    }}
                    options={PROVIDERS.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                  />
                </div>

                <div className="flex-1">
                  <label htmlFor="apiKey" className="block text-xs font-medium text-gray-600 mb-1">
                    API Key
                  </label>
                  <input
                    id="apiKey"
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setSaveSuccess(false);
                      setSaveError(null);
                    }}
                    placeholder="sk-..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !apiKey.trim()}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : getKeyInfo(provider) ? "Update key" : "Save key"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <ConfirmationDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Remove provider key"
        description={`This will remove the ${confirmDelete ?? ""} API key. Projects using this provider will stop working until a new key is configured.`}
        confirmations={[
          { label: "provider name", value: confirmDelete ?? "" },
        ]}
        warning={`Removing the ${confirmDelete ?? ""} key cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); }}
      />
    </div>
  );
}
