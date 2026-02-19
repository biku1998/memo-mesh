const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

// --- Auth ---

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export function getMe() {
  return request<AuthUser>("/v1/auth/me");
}

export function register(email: string, password: string) {
  return request<AuthUser>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string) {
  return request<AuthUser>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request<{ ok: boolean }>("/v1/auth/logout", { method: "POST" });
}

// --- Projects ---

export interface Project {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  createdAt: string;
}

export function getProjects() {
  return request<Project[]>("/v1/projects");
}

export function createProject(name: string, provider: "openai" | "anthropic" = "openai") {
  return request<Project>("/v1/projects", {
    method: "POST",
    body: JSON.stringify({ name, provider }),
  });
}

// --- Messages (uses X-API-Key) ---

export interface MessageRecord {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export function getMessages(projectId: string, apiKey: string, limit = 20) {
  return request<MessageRecord[]>(
    `/v1/projects/${projectId}/messages?limit=${limit}`,
    { headers: { "X-API-Key": apiKey } },
  );
}

export function sendMessage(projectId: string, apiKey: string, role: string, content: string) {
  return request<{ messageId: string }>(`/v1/projects/${projectId}/messages`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: JSON.stringify({ role, content }),
  });
}

export interface FactMemory {
  memoryId: string;
  text: string;
  type: string;
  status: string;
  confidence: number | null;
  importance: number | null;
  createdAt: string;
  sourceMessageId: string | null;
}

export function getFactMemories(projectId: string, apiKey: string, limit = 50) {
  return request<FactMemory[]>(
    `/v1/projects/${projectId}/memories?type=fact&status=active&limit=${limit}`,
    { headers: { "X-API-Key": apiKey } },
  );
}

// --- Memories ---

export interface SearchMemoryItem {
  memoryId: string;
  text: string;
  type: string;
  similarity: number;
  recencyBoost: number;
  finalScore: number;
  createdAt: string;
}

export interface ContextPackFact {
  memoryId: string;
  text: string;
  confidence: number | null;
  finalScore: number;
  evidenceMessageId: string | null;
}

export interface ContextPackEntity {
  entityId: string;
  name: string;
  kind: string;
  facts: ContextPackFact[];
}

export interface ContextPack {
  summary: string;
  entities: ContextPackEntity[];
  unattachedFacts: ContextPackFact[];
  totalFacts: number;
}

export interface SearchResponse {
  items: SearchMemoryItem[];
  contextPack: ContextPack;
}

export function searchMemories(
  projectId: string,
  apiKey: string,
  query: string,
  k = 10,
) {
  return request<SearchResponse>(`/v1/projects/${projectId}/memories/search`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: JSON.stringify({ query, k }),
  });
}

export interface RecentMemory {
  memoryId: string;
  text: string;
  type: string;
  confidence: number | null;
  createdAt: string;
}

export function getRecentFacts(projectId: string, apiKey: string) {
  return request<{ items: SearchMemoryItem[]; contextPack: ContextPack }>(
    `/v1/projects/${projectId}/memories/search`,
    {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: JSON.stringify({ query: "recent facts preferences", k: 20 }),
    },
  );
}

// --- Explain ---

export interface ExplainEvidence {
  messageId: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ExplainEntityMention {
  entityId: string;
  name: string;
  kind: string;
}

export interface SimilarMemory {
  memoryId: string;
  text: string;
  type: string;
  status: string;
  similarity: number;
}

export interface ExplainResponse {
  memory: {
    id: string;
    text: string;
    type: string;
    status: string;
    confidence: number | null;
    importance: number | null;
    createdAt: string;
  };
  evidence: ExplainEvidence | null;
  entityMentions: ExplainEntityMention[];
  similarMemories: SimilarMemory[];
}

export function explainMemory(projectId: string, apiKey: string, memoryId: string) {
  return request<ExplainResponse>(`/v1/projects/${projectId}/memories/${memoryId}/explain`, {
    headers: { "X-API-Key": apiKey },
  });
}

export { ApiError };
