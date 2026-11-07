import { z } from "zod";
export const intentSchema = z.object({
  summary: z.string().max(350), targetAnglesDeg: z.array(z.number().min(20).max(170)).min(2).max(16),
  mountDistanceCm: z.number().min(6).max(11).nullable(), uncertainty: z.string().max(350),
});
export type IntentProposal = z.infer<typeof intentSchema> & { baseInputHash: string; provider: string };
