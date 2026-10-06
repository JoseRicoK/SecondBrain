import { handleCallback } from "@vercel/queue";
import { processAnalysisJob } from "@/lib/diary-analysis-jobs";
export const maxDuration = 240;
export const POST = handleCallback<{ jobId: string; generation: string }>(
  async (message) => {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!message || !uuid.test(message.jobId) || !uuid.test(message.generation))
      return;
    await processAnalysisJob(message.jobId, message.generation);
  },
  {
    visibilityTimeoutSeconds: 300,
    retry: (_error, metadata) =>
      metadata.deliveryCount > 8
        ? { acknowledge: true }
        : { afterSeconds: Math.min(300, 30 * metadata.deliveryCount) },
  },
);
