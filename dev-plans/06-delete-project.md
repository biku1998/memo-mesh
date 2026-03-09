# Plan: Delete Project with All Related Data

## Context

There is currently no way to delete a project from the dashboard. Users who create test projects or want to clean up have no option to remove them. This feature adds a `DELETE /v1/projects/:projectId` API endpoint with cascading data removal, and a delete button with confirmation dialog on the Projects page.

## Backend: API Endpoint

### File: `apps/api/src/routes/projects.ts`

Add `DELETE /v1/projects/:projectId`:

1. **Auth**: Session auth (reuse existing pattern — `request.session.userId`)
2. **Ownership check**: `prisma.project.findFirst({ where: { id: projectId, userId } })` — return 404 if not found
3. **Cascading delete** in a Prisma `$transaction` with ordered `deleteMany` calls:
   ```
   1. MemoryEmbedding (WHERE memoryId IN memories of project)
   2. EntityMention   (WHERE memoryId IN memories OR entityId IN entities of project)
   3. Relation         (WHERE projectId)
   4. Memory           (WHERE projectId)
   5. Entity           (WHERE projectId)
   6. Message          (WHERE projectId)
   7. Project          (WHERE id = projectId)
   ```
4. Return `204 No Content`

**Why this order**: Foreign key constraints require child records to be deleted before parents. MemoryEmbedding depends on Memory, EntityMention depends on both Memory and Entity, Relation depends on Entity and Memory.

### Validation

Add a `DeleteProjectParams` Zod schema in `packages/shared` (or reuse existing `ProjectParams` if one exists) for the `:projectId` param.

## Frontend Changes

### File: `apps/web/src/lib/api.ts`

Add:
```typescript
deleteProject(projectId: string)  // DELETE /v1/projects/:projectId
```

### File: `apps/web/src/pages/ProjectsPage.tsx`

1. Add `useMutation` for `deleteProject` with `onSuccess` → invalidate projects query
2. Add state: `confirmDeleteId` (tracks which project's confirmation dialog is open)
3. Add a **delete button** (trash icon or text) to each project card — use the existing destructive ghost button pattern from SettingsPage
4. Wire up the existing `ConfirmationDialog` component:
   - `variant="danger"`
   - `warning="This will permanently delete the project and all its data (messages, memories, entities, relations). This action cannot be undone."`
   - `confirmations=[{ label: "Type the project name to confirm", value: projectName }]` — requires typing the project name
5. Toast feedback: `toast.success("Project deleted")` / `toast.error("Failed to delete project")`

### Reused existing components
- `ConfirmationDialog` at `apps/web/src/components/ConfirmationDialog.tsx` — already supports typed confirmation, danger variant, and warning banner
- Delete button pattern from `apps/web/src/pages/SettingsPage.tsx`
- Toast notifications via `sonner`

## Files to Modify

| File | Change |
|------|--------|
| `apps/api/src/routes/projects.ts` | Add DELETE endpoint with cascading delete |
| `apps/web/src/lib/api.ts` | Add `deleteProject()` function |
| `apps/web/src/pages/ProjectsPage.tsx` | Add delete button, mutation, confirmation dialog |

## Verification

1. Create a test project, send a few messages to populate data (messages, memories, entities, relations)
2. Go to Projects page → click delete on the project → type project name → confirm
3. Verify project disappears from the list
4. Verify via Prisma Studio (`pnpm db:studio`) that all related records are gone (messages, memories, memory_embeddings, entities, relations, entity_mentions)
5. Verify deleting someone else's project returns 404
