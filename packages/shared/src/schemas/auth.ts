import { z } from "zod";
import { ProviderEnum } from "./provider-keys.js";

export const RegisterBody = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const LoginBody = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const AuthUser = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.string(),
});
export type AuthUser = z.infer<typeof AuthUser>;

export const CreateProjectBody = z.object({
  name: z.string().min(1, "Name is required").max(100),
  provider: ProviderEnum.default("openai"),
});
export type CreateProjectBody = z.infer<typeof CreateProjectBody>;

export const UpdateProjectBody = z.object({
  provider: ProviderEnum,
});
export type UpdateProjectBody = z.infer<typeof UpdateProjectBody>;

// Returned from POST /v1/projects (includes apiKey shown once at creation).
export const CreateProjectResponse = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  apiKey: z.string(),
  createdAt: z.string(),
});
export type CreateProjectResponse = z.infer<typeof CreateProjectResponse>;

// Returned from GET /v1/projects (no apiKey — use GET /projects/:id/api-key).
export const ProjectListItem = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  createdAt: z.string(),
});
export type ProjectListItem = z.infer<typeof ProjectListItem>;
