import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  API_CATEGORIES,
  type ApiEndpoint,
  type AuthType,
  type EndpointCategory,
  type HttpMethod,
} from "@/data/api-endpoints";

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  PUT: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  PATCH: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const AUTH_LABELS: Record<AuthType, { text: string; className: string }> = {
  none: { text: "No auth", className: "text-muted-foreground" },
  session: { text: "Session cookie", className: "text-violet-600 dark:text-violet-400" },
  "api-key": { text: "X-API-Key", className: "text-cyan-600 dark:text-cyan-400" },
};

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <Badge
      variant="secondary"
      className={`${METHOD_COLORS[method]} border-0 font-mono font-semibold text-xs rounded-md`}
    >
      {method}
    </Badge>
  );
}

function AuthLabel({ auth }: { auth: AuthType }) {
  const { text, className } = AUTH_LABELS[auth];
  return <span className={`text-xs font-medium ${className}`}>{text}</span>;
}

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const hasDetails =
    endpoint.requestBody || endpoint.queryParams?.length;

  return (
    <Card className="rounded-lg">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <MethodBadge method={endpoint.method} />
          <code className="text-sm font-mono font-medium text-foreground">
            {endpoint.path}
          </code>
          <AuthLabel auth={endpoint.auth} />
        </div>

        <p className="text-sm text-muted-foreground">{endpoint.description}</p>

        {hasDetails && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors select-none">
              Request details
            </summary>
            <div className="mt-2 space-y-3">
              {endpoint.queryParams && endpoint.queryParams.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Query Parameters
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-1 pr-4 font-medium text-muted-foreground">
                            Name
                          </th>
                          <th className="py-1 pr-4 font-medium text-muted-foreground">
                            Type
                          </th>
                          <th className="py-1 pr-4 font-medium text-muted-foreground">
                            Required
                          </th>
                          <th className="py-1 font-medium text-muted-foreground">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.queryParams.map((p) => (
                          <tr key={p.name} className="border-b border-border/50">
                            <td className="py-1 pr-4 font-mono text-xs">
                              {p.name}
                            </td>
                            <td className="py-1 pr-4 text-muted-foreground text-xs">
                              {p.type}
                            </td>
                            <td className="py-1 pr-4 text-xs">
                              {p.required ? "Yes" : "No"}
                            </td>
                            <td className="py-1 text-xs text-muted-foreground">
                              {p.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {endpoint.requestBody && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Request Body
                  </p>
                  <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
                    <code>{endpoint.requestBody}</code>
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}

        <div>
          <details className="group" open={!hasDetails}>
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors select-none">
              Response
            </summary>
            <pre className="mt-2 bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
              <code>{endpoint.responseBody}</code>
            </pre>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}

function CategorySection({ category }: { category: EndpointCategory }) {
  return (
    <section id={category.slug} className="space-y-3 scroll-mt-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {category.name}
        </h3>
        <p className="text-sm text-muted-foreground">{category.description}</p>
      </div>

      <div className="space-y-3">
        {category.endpoints.map((ep) => (
          <EndpointCard key={`${ep.method}-${ep.path}`} endpoint={ep} />
        ))}
      </div>
    </section>
  );
}

export function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">API Reference</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Complete reference for the Memo Mesh REST API. All endpoints are
          served from the API server (default:{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            http://localhost:3000
          </code>
          ).
        </p>
      </div>

      {/* Auth legend */}
      <Card className="rounded-lg">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Authentication Types
          </h3>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-center gap-2">
              <AuthLabel auth="none" />
              <span className="text-muted-foreground">
                — No authentication required
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AuthLabel auth="session" />
              <span className="text-muted-foreground">
                — HttpOnly session cookie (set via login)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AuthLabel auth="api-key" />
              <span className="text-muted-foreground">
                — Per-project API key in the{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  X-API-Key
                </code>{" "}
                header
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table of contents */}
      <Card className="rounded-lg">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Contents
          </h3>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            {API_CATEGORIES.map((cat) => (
              <a
                key={cat.slug}
                href={`#${cat.slug}`}
                className="text-sm text-primary hover:underline underline-offset-2"
              >
                {cat.name}
                <span className="text-muted-foreground ml-1 text-xs">
                  ({cat.endpoints.length})
                </span>
              </a>
            ))}
          </nav>
        </CardContent>
      </Card>

      {/* Endpoint categories */}
      {API_CATEGORIES.map((cat) => (
        <CategorySection key={cat.slug} category={cat} />
      ))}
    </div>
  );
}
