# 4F — Memory Explorer Page

## Context

The Memory Explorer is the last missing page in Phase 4 of the dashboard. It provides a browsable, filterable list of all memories (facts and raw) for a project, with pagination and explain drawer integration. Currently, users can only see memories through the Workbench (limited to active facts) or via search results. This page gives full visibility into the memory store.

Reference: `dev-plans/plan.md` Phase 4F checklist.

---

## Implementation Plan

### Step 1: Extract ExplainDrawer to shared component

**Create** `apps/web/src/components/ExplainDrawer.tsx`

Extract from `apps/web/src/pages/WorkbenchPage.tsx` (lines 28-175):
- `ExplainDrawer` — props: `{ memoryId, projectId, apiKey, onClose }`
- `ExplainContent` — props: `{ data: ExplainResponse }`
- `StatusBadge` — props: `{ status: string }`

**Modify** `apps/web/src/pages/WorkbenchPage.tsx`
- Remove the three extracted functions
- Add `import { ExplainDrawer } from "../components/ExplainDrawer"`
- No other changes needed — all usage sites stay the same

### Step 2: Add session-auth memories list API endpoint

**Create** `apps/api/src/routes/dashboardMemories.ts`

Route: `GET /v1/projects/:projectId/dashboard/memories`
Auth: Session-based (check `request.session.userId` + verify project ownership via `prisma.project.findFirst({ where: { id: projectId, userId } })`) — follows the exact pattern in `apps/api/src/routes/projects.ts` lines 62-85.

Query params (validated with Zod inline, same as `memories.ts` pattern):

```text
type:   "fact" | "raw" (optional — omit to get all types)
status: "active" | "superseded" (optional — omit to get all statuses)
cursor: string (optional — memory ID for cursor pagination)
limit:  number 1-100, default 30
```

Query pattern (reuse existing pattern from `memories.ts` line 44-58):
```ts
prisma.memory.findMany({
  where: { projectId, ...(type && { type }), ...(status && { status }) },
  orderBy: { createdAt: "desc" },
  take: limit + 1,  // +1 to detect hasMore
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  select: { id, text, type, status, confidence, importance, createdAt, sourceMessageId },
})
```

Response shape:
```ts
{
  memories: Array<{ memoryId, text, type, status, confidence, importance, createdAt, sourceMessageId }>,
  nextCursor: string | null,
  hasMore: boolean,
}
```

The `+1` trick: fetch `limit + 1` rows, if we get more than `limit` then `hasMore = true` and `nextCursor = memories[limit - 1].id`. Slice result to `limit` before sending.

**Modify** `apps/api/src/index.ts`
- Import and register: `fastify.register(dashboardMemoryRoutes)` alongside `projectRoutes` (line 48 area)

### Step 3: Add frontend API client function

**Modify** `apps/web/src/lib/api.ts`

Add types and function (session-auth, no API key needed):
```ts
export interface MemoryListResponse {
  memories: FactMemory[];  // reuse existing FactMemory interface
  nextCursor: string | null;
  hasMore: boolean;
}

export function getMemories(
  projectId: string,
  params?: { type?: string; status?: string; cursor?: string; limit?: number },
): Promise<MemoryListResponse> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.status) qs.set("status", params.status);
  if (params?.cursor) qs.set("cursor", params.cursor);
  if (params?.limit) qs.set("limit", String(params.limit));
  return request<MemoryListResponse>(
    `/v1/projects/${projectId}/dashboard/memories?${qs.toString()}`,
  );
}
```

Note: `FactMemory` interface (already in api.ts line 115-124) has the exact fields returned by the endpoint.

### Step 4: Create MemoryExplorerPage

**Create** `apps/web/src/pages/MemoryExplorerPage.tsx`

Layout:
```
Header (breadcrumb: Projects / {name}, links to Workbench and Knowledge Graph)
Filter bar (type Select + status Select)
Memory list (scrollable Card rows)
  └── Each row: text, StatusBadge, type badge, confidence %, createdAt, "Explain →" button
"Load more" button (when hasMore)
ExplainDrawer (conditional overlay)
```

Key patterns:
- **Route param**: `useParams({ from: "/protected/projects/$projectId/memories" })`
- **Filters**: Two `<Select>` components (reuse from `@/components/ui/select`):
  - Type: All / Fact / Raw
  - Status: All / Active / Superseded
  - `useState` for each, default "all" (sends no filter param)
- **Data fetching**: `useInfiniteQuery` from `@tanstack/react-query`:
  - `queryKey: ["memories", projectId, typeFilter, statusFilter]`
  - `queryFn: ({ pageParam }) => getMemories(projectId, { type, status, cursor: pageParam, limit: 30 })`
  - `getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined`
  - `initialPageParam: null`
  - Filter changes auto-reset the query (different queryKey)
- **Memory rows**: Use `<Card size="sm">` + `<CardContent>` (same pattern as FactMemoryCard in WorkbenchPage)
  - Text with `line-clamp-2`
  - `<StatusBadge>` (imported from `../components/ExplainDrawer`)
  - Type badge (inline `<span>` like ExplainContent line 94-96)
  - Confidence percentage (if not null)
  - `createdAt` with `toLocaleDateString()`
  - `<Button variant="link">Explain →</Button>` that sets `explainMemoryId`
- **Infinite scroll**: `useRef` sentinel div at list bottom + `IntersectionObserver` in `useEffect` that calls `fetchNextPage()` when in view and `hasNextPage && !isFetchingNextPage`
- **Empty state**: "No memories yet" centered message (guarded by `!isLoading && !isError`)
- **Error state**: Error message shown when `isError` is true
- **Loading**: "Loading…" text during initial fetch and next-page fetch

### Step 5: Register the route

**Modify** `apps/web/src/router.tsx`
- Import `MemoryExplorerPage`
- Add route:
  ```ts
  const memoriesRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: "/projects/$projectId/memories",
    component: MemoryExplorerPage,
  });
  ```
- Add to route tree: `protectedRoute.addChildren([projectsRoute, workbenchRoute, graphRoute, memoriesRoute, settingsRoute])`

### Step 6: Add cross-navigation links

**Modify** `apps/web/src/pages/WorkbenchPage.tsx`
- In the header (line 651-657), add a "Memories" link before the existing "Knowledge Graph →" link

**Modify** `apps/web/src/pages/KnowledgeGraphPage.tsx`
- Add a "Memories" link in the header bar for cross-navigation

### Step 7: Update plan.md progress

**Modify** `dev-plans/plan.md`
- Mark 4F tasks as complete
- Update progress tracking section

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/components/ExplainDrawer.tsx` | CREATE | Shared ExplainDrawer + StatusBadge |
| `apps/api/src/routes/dashboardMemories.ts` | CREATE | Session-auth paginated memories endpoint |
| `apps/web/src/pages/MemoryExplorerPage.tsx` | CREATE | Memory explorer page component |
| `apps/api/src/index.ts` | MODIFY | Register dashboardMemoryRoutes |
| `apps/web/src/lib/api.ts` | MODIFY | Add getMemories() + MemoryListResponse type |
| `apps/web/src/router.tsx` | MODIFY | Add memories route |
| `apps/web/src/pages/WorkbenchPage.tsx` | MODIFY | Import extracted ExplainDrawer, add nav link |
| `apps/web/src/pages/KnowledgeGraphPage.tsx` | MODIFY | Add Memories nav link |
| `dev-plans/plan.md` | MODIFY | Mark 4F complete |

---

## Verification

1. **Backend**: `curl -b cookies.txt "http://localhost:3000/v1/projects/<ID>/dashboard/memories?limit=5"` returns paginated memories with `nextCursor`
2. **Backend filters**: Add `?type=fact&status=superseded` — returns only superseded facts
3. **Backend pagination**: Use `?cursor=<nextCursor>` — returns next page
4. **Frontend**: Navigate to `/projects/<id>/memories` — see memory list with filters
5. **Filters**: Change type/status selects — list updates
6. **Load more**: Click "Load more" — next page appends
7. **Explain**: Click "Explain →" on any row — drawer opens with provenance
8. **Navigation**: Workbench and Graph pages have "Memories" link; Memories page links back
9. **Type-check**: `npx tsc --noEmit -p apps/web/tsconfig.json` passes
10. **WorkbenchPage**: Verify ExplainDrawer still works after extraction (no regressions)
