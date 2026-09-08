import type { StepTrace, ToolCallTrace, Trace } from "./types.js";

interface OpenStep {
  agentName: string;
  input: unknown;
  toolCalls: ToolCallTrace[];
  startedAtMs: number;
}

interface EndStepResult {
  rawOutput?: unknown;
  modelUsed?: string;
  usage?: { inputTokens: number; outputTokens: number };
  stopReason?: string;
  error?: string;
}

/**
 * Captures one Trace (a sequence of StepTraces) for a single pipeline run.
 * The pipeline calls startStep/endStep around each agent invocation; agents
 * that make tool calls (e.g. a KB search) call recordToolCall in between.
 */
export class TraceRecorder {
  private readonly steps: StepTrace[] = [];
  private openStep: OpenStep | null = null;

  constructor(
    private readonly ticketId: string,
    private readonly runId: string,
  ) {}

  startStep(agentName: string, input: unknown): void {
    if (this.openStep) {
      throw new Error(
        `Cannot start step "${agentName}" while step "${this.openStep.agentName}" is still open`,
      );
    }
    this.openStep = { agentName, input, toolCalls: [], startedAtMs: Date.now() };
  }

  recordToolCall(call: ToolCallTrace): void {
    if (!this.openStep) {
      throw new Error("recordToolCall called with no open step");
    }
    this.openStep.toolCalls.push(call);
  }

  endStep(result: EndStepResult = {}): void {
    if (!this.openStep) {
      throw new Error("endStep called with no open step");
    }
    const { agentName, input, toolCalls, startedAtMs } = this.openStep;
    const endedAtMs = Date.now();
    this.steps.push({
      agentName,
      input,
      toolCalls,
      startedAt: new Date(startedAtMs).toISOString(),
      endedAt: new Date(endedAtMs).toISOString(),
      durationMs: endedAtMs - startedAtMs,
      ...result,
    });
    this.openStep = null;
  }

  toTrace(): Trace {
    return {
      ticketId: this.ticketId,
      runId: this.runId,
      createdAt: new Date().toISOString(),
      steps: this.steps,
    };
  }
}
