import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProviderKeys, upsertProviderKey, deleteProviderKey, ApiError } from "../lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your provider API keys. Keys are encrypted at rest.
        </p>
      </div>

      {serverUnavailable && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 text-sm">
          Key storage is unavailable — <code className="font-mono">KEY_ENCRYPTION_SECRET</code> is not
          configured on the server. Set it in your environment and restart the API.
        </div>
      )}

      {/* Current keys status */}
      {!serverUnavailable && (
        <Card>
          <CardContent className="divide-y divide-border">
            {PROVIDERS.map((p) => {
              const info = getKeyInfo(p);
              return (
                <div key={p} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-card-foreground capitalize">{p}</p>
                    {isLoading ? (
                      <p className="text-xs text-muted-foreground mt-0.5">Loading…</p>
                    ) : info ? (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {info.maskedKey}
                        <span className="font-sans ml-2 text-muted-foreground/50">·</span>
                        <span className="font-sans ml-2">
                          Updated {new Date(info.updatedAt).toLocaleDateString()}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Not configured</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {info && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDelete(p)}
                        disabled={deleting === p}
                      >
                        {deleting === p ? "Removing…" : "Remove"}
                      </Button>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 font-medium ${
                        info
                          ? "bg-accent text-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {info ? "Configured" : "Not set"}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Set / update key form */}
      {!serverUnavailable && (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">
                {getKeyInfo(provider) ? "Update a provider key" : "Set a provider key"}
              </h3>
              {getKeyInfo(provider) && (
                <p className="text-xs text-destructive mt-1">
                  A key already exists for {provider}. Saving will replace it.
                </p>
              )}
            </div>

            {saveSuccess && (
              <div className="bg-accent text-foreground px-3 py-2 text-sm">
                Key saved successfully.
              </div>
            )}
            {saveError && (
              <div className="bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {saveError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-3">
                <div className="w-40">
                  <label htmlFor="provider" className="block text-xs font-medium text-muted-foreground mb-1">
                    Provider
                  </label>
                  <Select
                    value={provider}
                    onValueChange={(v) => {
                      setProvider(v as Provider);
                      setSaveSuccess(false);
                      setSaveError(null);
                    }}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <label htmlFor="apiKey" className="block text-xs font-medium text-muted-foreground mb-1">
                    API Key
                  </label>
                  <Input
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
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving || !apiKey.trim()}>
                  {saving ? "Saving…" : getKeyInfo(provider) ? "Update key" : "Save key"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
