# Plan: API Docs Page

## Context

There's currently no way to see available API endpoints from the dashboard. This adds a static API reference page at `/api-docs` so users can browse all endpoints, their auth requirements, and request/response shapes without leaving the app.

## Files to Create

1. **`apps/web/src/data/api-endpoints.ts`** — Hardcoded endpoint definitions (all 22 endpoints in 8 categories)
2. **`apps/web/src/pages/ApiDocsPage.tsx`** — The page component

## Files to Modify

1. **`apps/web/src/router.tsx`** — Add `/api-docs` route under `protectedRoute`
2. **`apps/web/src/components/AppSidebar.tsx`** — Add `BookOpenIcon` nav link above Settings

## Steps

### 1. Install shadcn Badge component
```bash
pnpm -C apps/web dlx shadcn@latest add badge
```
Creates `apps/web/src/components/ui/badge.tsx`. If the CLI fails, manually create a minimal Badge using the same CVA pattern as the existing Button component.

### 2. Create endpoint data — `apps/web/src/data/api-endpoints.ts`

Define types and export `API_CATEGORIES`:

```typescript
type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
type AuthType = "none" | "session" | "api-key"

interface ApiEndpoint {
  method: HttpMethod
  path: string
  description: string
  auth: AuthType
  queryParams?: { name: string; type: string; required: boolean; description: string }[]
  requestBody?: string   // formatted JSON-like string
  responseBody: string   // formatted JSON-like string
}

interface EndpointCategory {
  name: string
  description: string
  endpoints: ApiEndpoint[]
}
```

8 categories: Auth (4), Projects (4), Messages (2), Memories (2), Search (1), Graph (2), Dashboard Memories (2), Provider Keys (4), Health (1).

### 3. Create page — `apps/web/src/pages/ApiDocsPage.tsx`

Layout (follows SettingsPage pattern but wider — `max-w-4xl`):
- **Header**: "API Reference" title + subtitle
- **Table of contents**: Card with anchor links to each category
- **Auth legend**: Brief explanation of "None", "Session cookie", "X-API-Key"
- **Category sections**: Each with `id` for anchor scrolling, containing endpoint cards

Each endpoint card shows:
- Color-coded method badge (GET=green, POST=blue, PUT=orange, PATCH=amber, DELETE=red)
- Path in monospace
- Auth type label (muted text)
- Description
- Collapsible request/response section using native `<details>`/`<summary>` with `<pre><code>` blocks

Sub-components defined inline: `MethodBadge`, `AuthLabel`, `EndpointCard`, `CategorySection`.

### 4. Add route — `apps/web/src/router.tsx`

```typescript
const apiDocsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/api-docs",
  component: ApiDocsPage,
});
```

Add `apiDocsRoute` to the `protectedRoute.addChildren([...])` array.

### 5. Add sidebar nav — `apps/web/src/components/AppSidebar.tsx`

Import `BookOpenIcon` from `lucide-react`. Add above Settings in the bottom section:

```tsx
<NavIcon to="/api-docs" icon={BookOpenIcon} label="API Docs" />
<NavIcon to="/settings" icon={SettingsIcon} label="Settings" />
```

## Verification

1. `pnpm -C apps/web typecheck` — no type errors
2. `pnpm -C apps/web build` — build succeeds
3. `pnpm dev` — navigate to `/api-docs`, verify:
   - All 22 endpoints visible across 8+ categories
   - Method badges are color-coded
   - Auth types shown correctly
   - Collapsible request/response sections work
   - Table of contents anchor links scroll to sections
   - Sidebar icon active state works on `/api-docs`
