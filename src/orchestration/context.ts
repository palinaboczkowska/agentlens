export interface Ticket {
  id: string;
  subject: string;
  body: string;
}

export type TicketCategory =
  | "billing"
  | "technical-bug"
  | "account-access"
  | "feature-request"
  | "other";

export type Urgency = "low" | "medium" | "high";

export interface Classification {
  category: TicketCategory;
  urgency: Urgency;
  confidenceNote: string;
}

export interface RetrievedDoc {
  docId: string;
  title: string;
  content: string;
  score: number;
}

export interface SupervisorVerdict {
  verdict: "approve" | "reject";
  groundednessCheck: string;
  rationale: string;
}

/**
 * Shared "blackboard" object the triage pipeline's agents read from and
 * contribute to. Each agent returns only the fields it adds.
 */
export interface TicketContext {
  ticket: Ticket;
  classification?: Classification;
  retrievedDocs?: RetrievedDoc[];
  draft?: string;
  supervisorVerdict?: SupervisorVerdict;
}
