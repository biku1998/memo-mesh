import { z } from "zod";

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
  provider: z.enum(["openai", "anthropic"]).default("openai"),
});
export type CreateProjectBody = z.infer<typeof CreateProjectBody>;

export const ProjectResponse = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  apiKey: z.string(),
  createdAt: z.string(),
});
export type ProjectResponse = z.infer<typeof ProjectResponse>;
