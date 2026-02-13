import { z } from "zod";

export const MessageRole = z.enum(["user", "assistant", "system"]);

export const CreateMessageBody = z.object({
  role: MessageRole,
  content: z.string().min(1, "Content must not be empty"),
});

export type CreateMessageBody = z.infer<typeof CreateMessageBody>;

export const CreateMessageResponse = z.object({
  messageId: z.string(),
});

export type CreateMessageResponse = z.infer<typeof CreateMessageResponse>;
