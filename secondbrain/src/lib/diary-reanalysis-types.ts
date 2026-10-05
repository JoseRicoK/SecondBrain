export interface ReanalysisJob {
  id: string;
  userId: string;
  status: "running" | "completed" | "canceled";
  total: number;
  done: number;
  failed: number;
  skipped: number;
  pending: number;
  peoplePending: number;
  inFlight: boolean;
  createdAt: string;
  issues: {
    date: string;
    code:
      "provider" | "invalid" | "changed" | "deleted" | "too_long" | "canceled";
  }[];
}
export interface ReanalysisStatus {
  eligible: number;
  peoplePending: number;
  job: ReanalysisJob | null;
}
