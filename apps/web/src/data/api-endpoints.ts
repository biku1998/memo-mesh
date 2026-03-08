export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type AuthType = "none" | "session" | "api-key";

export interface QueryParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  description: string;
  auth: AuthType;
  queryParams?: QueryParam[];
  requestBody?: string;
  responseBody: string;
}

export interface EndpointCategory {
  name: string;
  slug: string;
  description: string;
  endpoints: ApiEndpoint[];
}

export const API_CATEGORIES: EndpointCategory[] = [
  {
    name: "Health",
    slug: "health",
    description: "Server health check",
    endpoints: [
      {
        method: "GET",
        path: "/health",
        description: "Check if the API server is running.",
        auth: "none",
        responseBody: `{
  "status": "ok"
}`,
      },
    ],
  },
  {
    name: "Auth",
    slug: "auth",
    description: "User registration, login, and session management",
    endpoints: [
      {
        method: "POST",
        path: "/v1/auth/register",
        description: "Register a new user account.",
        auth: "none",
        requestBody: `{
  "email": "string (valid email)",
  "password": "string (min 8 chars)"
}`,
        responseBody: `{
  "id": "UUID",
  "email": "string",
  "createdAt": "ISO 8601"
}`,
      },
      {
        method: "POST",
        path: "/v1/auth/login",
        description: "Log in with email and password. Sets an HttpOnly session cookie.",
        auth: "none",
        requestBody: `{
  "email": "string (valid email)",
  "password": "string"
}`,
        responseBody: `{
  "id": "UUID",
  "email": "string",
  "createdAt": "ISO 8601"
}`,
      },
      {
        method: "POST",
        path: "/v1/auth/logout",
        description: "Log out and clear the session cookie.",
        auth: "session",
        responseBody: `{
  "ok": true
}`,
      },
      {
        method: "GET",
        path: "/v1/auth/me",
        description: "Get the currently authenticated user.",
        auth: "session",
        responseBody: `{
  "id": "UUID",
  "email": "string",
  "createdAt": "ISO 8601"
}`,
      },
    ],
  },
  {
    name: "Projects",
    slug: "projects",
    description: "Create and manage projects",
    endpoints: [
      {
        method: "POST",
        path: "/v1/projects",
        description:
          "Create a new project. Automatically generates an API key (mm_ prefix).",
        auth: "session",
        requestBody: `{
  "name": "string (1-100 chars)",
  "provider": "\"openai\" | \"anthropic\" (default: \"openai\")"
}`,
        responseBody: `{
  "id": "UUID",
  "name": "string",
  "provider": "string",
  "apiKey": "string (mm_...)",
  "createdAt": "ISO 8601"
}`,
      },
      {
        method: "GET",
        path: "/v1/projects",
        description: "List all projects owned by the current user.",
        auth: "session",
        responseBody: `[
  {
    "id": "UUID",
    "name": "string",
    "provider": "string",
    "createdAt": "ISO 8601"
  }
]`,
      },
      {
        method: "PATCH",
        path: "/v1/projects/:projectId",
        description: "Update project settings (e.g. switch provider).",
        auth: "session",
        requestBody: `{
  "provider": "\"openai\" | \"anthropic\""
}`,
        responseBody: `{
  "id": "UUID",
  "name": "string",
  "provider": "string",
  "createdAt": "ISO 8601"
}`,
      },
      {
        method: "GET",
        path: "/v1/projects/:projectId/api-key",
        description: "Retrieve the API key for a project.",
        auth: "session",
        responseBody: `{
  "apiKey": "string (mm_...)"
}`,
      },
    ],
  },
  {
    name: "Messages",
    slug: "messages",
    description: "Ingest messages for fact extraction and memory creation",
    endpoints: [
      {
        method: "POST",
        path: "/v1/projects/:projectId/messages",
        description:
          "Ingest a message. Creates a raw memory and triggers async embedding + knowledge extraction (entities, facts, relations).",
        auth: "api-key",
        requestBody: `{
  "role": "\"user\" | \"assistant\" | \"system\"",
  "content": "string (non-empty)"
}`,
        responseBody: `{
  "messageId": "UUID"
}`,
      },
      {
        method: "GET",
        path: "/v1/projects/:projectId/messages",
        description: "List recent messages for a project.",
        auth: "api-key",
        queryParams: [
          {
            name: "limit",
            type: "number",
            required: false,
            description: "Number of messages to return (1-100, default 20)",
          },
        ],
        responseBody: `[
  {
    "id": "UUID",
    "role": "string",
    "content": "string",
    "createdAt": "ISO 8601"
  }
]`,
      },
    ],
  },
  {
    name: "Memories",
    slug: "memories",
    description: "List and inspect extracted memories",
    endpoints: [
      {
        method: "GET",
        path: "/v1/projects/:projectId/memories",
        description: "List memories for a project, filtered by type and status.",
        auth: "api-key",
        queryParams: [
          {
            name: "type",
            type: "string",
            required: false,
            description: 'Memory type: "fact" or "raw" (default: "fact")',
          },
          {
            name: "status",
            type: "string",
            required: false,
            description:
              'Memory status: "active" or "superseded" (default: "active")',
          },
          {
            name: "limit",
            type: "number",
            required: false,
            description: "Max results (1-200, default 50)",
          },
        ],
        responseBody: `[
  {
    "memoryId": "UUID",
    "text": "string",
    "type": "\"fact\" | \"raw\"",
    "status": "\"active\" | \"superseded\"",
    "confidence": "number (0-1)",
    "importance": "number (0-1) | null",
    "createdAt": "ISO 8601",
    "sourceMessageId": "UUID"
  }
]`,
      },
      {
        method: "GET",
        path: "/v1/projects/:projectId/memories/:memoryId/explain",
        description:
          "Get full provenance for a memory: source message, entity mentions, and similar memories (consolidation history).",
        auth: "api-key",
        responseBody: `{
  "memory": {
    "id": "UUID",
    "text": "string",
    "type": "string",
    "status": "string",
    "confidence": "number | null",
    "importance": "number | null",
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  },
  "evidence": {
    "messageId": "UUID",
    "role": "string",
    "content": "string",
    "createdAt": "ISO 8601"
  } | null,
  "entityMentions": [
    { "entityId": "UUID", "name": "string", "kind": "string" }
  ],
  "similarMemories": [
    {
      "memoryId": "UUID",
      "text": "string",
      "type": "string",
      "status": "string",
      "similarity": "number"
    }
  ]
}`,
      },
    ],
  },
  {
    name: "Search",
    slug: "search",
    description: "Semantic memory search with context pack",
    endpoints: [
      {
        method: "POST",
        path: "/v1/projects/:projectId/memories/search",
        description:
          "Search memories by semantic similarity. Returns ranked results and a context pack grouped by entity, ready for LLM consumption.",
        auth: "api-key",
        requestBody: `{
  "query": "string (non-empty)",
  "k": "number (1-50, default 10)",
  "includeRaw": "boolean (default false)"
}`,
        responseBody: `{
  "items": [
    {
      "memoryId": "UUID",
      "text": "string",
      "type": "string",
      "similarity": "number",
      "recencyBoost": "number",
      "finalScore": "number",
      "createdAt": "ISO 8601"
    }
  ],
  "contextPack": {
    "summary": "string",
    "entities": [
      {
        "entityId": "UUID",
        "name": "string",
        "kind": "string",
        "facts": [
          {
            "memoryId": "UUID",
            "text": "string",
            "confidence": "number",
            "finalScore": "number",
            "evidenceMessageId": "UUID"
          }
        ]
      }
    ],
    "unattachedFacts": [ ... ],
    "totalFacts": "number"
  }
}`,
      },
    ],
  },
  {
    name: "Knowledge Graph",
    slug: "graph",
    description: "Entity and relation graph for a project",
    endpoints: [
      {
        method: "GET",
        path: "/v1/projects/:projectId/graph",
        description:
          "Get the knowledge graph (entities as nodes, relations as edges).",
        auth: "api-key",
        queryParams: [
          {
            name: "limit",
            type: "number",
            required: false,
            description: "Max entities to return (1-500, default 100)",
          },
        ],
        responseBody: `{
  "nodes": [
    {
      "id": "UUID",
      "name": "string",
      "normalizedName": "string",
      "kind": "string",
      "createdAt": "ISO 8601"
    }
  ],
  "edges": [
    {
      "id": "UUID",
      "subjectEntityId": "UUID",
      "predicate": "string",
      "objectEntityId": "UUID",
      "confidence": "number",
      "evidenceMemoryId": "UUID",
      "createdAt": "ISO 8601"
    }
  ]
}`,
      },
      {
        method: "GET",
        path: "/v1/projects/:projectId/graph/entity/:entityId",
        description:
          "Get details for a specific entity including its relations and evidence memories.",
        auth: "api-key",
        responseBody: `{
  "entity": {
    "id": "UUID",
    "name": "string",
    "normalizedName": "string",
    "kind": "string",
    "createdAt": "ISO 8601"
  },
  "relations": {
    "outgoing": [
      {
        "id": "UUID",
        "predicate": "string",
        "target": { "id": "UUID", "name": "string", "kind": "string" },
        "confidence": "number",
        "evidence": { "memoryId": "UUID", "text": "string" }
      }
    ],
    "incoming": [ ... ]
  },
  "mentions": [
    {
      "memoryId": "UUID",
      "text": "string",
      "type": "string",
      "createdAt": "ISO 8601"
    }
  ]
}`,
      },
    ],
  },
  {
    name: "Dashboard Memories",
    slug: "dashboard-memories",
    description:
      "Session-authenticated memory endpoints for the dashboard UI (cursor-based pagination)",
    endpoints: [
      {
        method: "GET",
        path: "/v1/projects/:projectId/dashboard/memories",
        description:
          "List memories with cursor-based pagination. Used by the Memory Explorer page.",
        auth: "session",
        queryParams: [
          {
            name: "type",
            type: "string",
            required: false,
            description: '"fact" | "raw" (optional filter)',
          },
          {
            name: "status",
            type: "string",
            required: false,
            description: '"active" | "superseded" (optional filter)',
          },
          {
            name: "cursor",
            type: "string",
            required: false,
            description: "Cursor for next page",
          },
          {
            name: "limit",
            type: "number",
            required: false,
            description: "Results per page (1-100, default 30)",
          },
        ],
        responseBody: `{
  "memories": [
    {
      "memoryId": "UUID",
      "text": "string",
      "type": "string",
      "status": "string",
      "confidence": "number | null",
      "importance": "number | null",
      "createdAt": "ISO 8601",
      "sourceMessageId": "UUID"
    }
  ],
  "nextCursor": "string | null",
  "hasMore": "boolean"
}`,
      },
      {
        method: "GET",
        path: "/v1/projects/:projectId/dashboard/memories/:memoryId/explain",
        description:
          "Same as the API-key explain endpoint, but authenticated via session cookie.",
        auth: "session",
        responseBody: `{
  "memory": { ... },
  "evidence": { ... } | null,
  "entityMentions": [ ... ],
  "similarMemories": [ ... ]
}`,
      },
    ],
  },
  {
    name: "Provider Keys",
    slug: "provider-keys",
    description:
      "Manage encrypted LLM provider API keys (AES-256-GCM at rest)",
    endpoints: [
      {
        method: "PUT",
        path: "/v1/admin/provider-keys",
        description:
          "Store or update an encrypted provider API key. The raw key is never logged or returned.",
        auth: "session",
        requestBody: `{
  "provider": "\"openai\" | \"anthropic\"",
  "key": "string (non-empty)"
}`,
        responseBody: `{
  "provider": "string",
  "updatedAt": "ISO 8601"
}`,
      },
      {
        method: "GET",
        path: "/v1/admin/provider-keys",
        description:
          "List stored provider keys. Returns masked metadata only — never the raw key.",
        auth: "session",
        responseBody: `[
  {
    "provider": "string",
    "maskedKey": "string (e.g. sk-...xxxx)",
    "updatedAt": "ISO 8601"
  }
]`,
      },
      {
        method: "DELETE",
        path: "/v1/admin/provider-keys/:provider",
        description: "Delete a stored provider key.",
        auth: "session",
        responseBody: `{
  "ok": true
}`,
      },
      {
        method: "GET",
        path: "/v1/admin/provider-availability",
        description:
          "Check which providers have a key configured (either via DB or environment variable).",
        auth: "session",
        responseBody: `[
  {
    "provider": "string",
    "available": "boolean"
  }
]`,
      },
    ],
  },
];
