import { z } from "zod";

export const ToolCallTraceSchema = z.object({
  toolName: z.string(),
  input: z.unknown(),
  output: z.unknown().optional(),
  latencyMs: z.number(),
  isError: z.boolean(),
  retrievedDocs: z
    .array(z.object({ docId: z.string(), score: z.number() }))
    .optional(),
});

export const StepTraceSchema = z.object({
  agentName: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  durationMs: z.number(),
  input: z.unknown(),
  modelUsed: z.string().optional(),
  toolCalls: z.array(ToolCallTraceSchema).default([]),
  rawOutput: z.unknown().optional(),
  usage: z
    .object({ inputTokens: z.number(), outputTokens: z.number() })
    .optional(),
  stopReason: z.string().optional(),
  error: z.string().optional(),
});

export const TraceSchema = z.object({
  ticketId: z.string(),
  runId: z.string(),
  createdAt: z.string(),
  steps: z.array(StepTraceSchema),
});

export type ToolCallTrace = z.infer<typeof ToolCallTraceSchema>;
export type StepTrace = z.infer<typeof StepTraceSchema>;
export type Trace = z.infer<typeof TraceSchema>;
