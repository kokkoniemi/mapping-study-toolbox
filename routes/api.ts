import { Router } from "express";

import { createRateLimitMiddleware } from "../lib/security";
import * as records from "./records";
import * as mappingQuestions from "./mappingQuestions";
import * as forums from "./forums";

const router = Router();
const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};
const enrichmentRateLimit = createRateLimitMiddleware({
  windowMs: parsePositiveInteger(process.env.ENRICHMENT_RATE_LIMIT_WINDOW_MS, 60_000),
  maxRequests: parsePositiveInteger(process.env.ENRICHMENT_RATE_LIMIT_MAX_REQUESTS, 20),
  scope: "enrichment",
});

router.get("/health", (_req, res) => {
  res.send({ status: "ok" });
});

// RECORDS
router.get("/records", records.listing);
router.get("/records/:id", records.get);
router.patch("/records/:id", records.patch);
router.put("/records/:id", records.update);
router.post("/records/enrichment-jobs", enrichmentRateLimit, records.createEnrichment);
router.get("/records/enrichment-jobs/:jobId", records.getEnrichment);
router.post("/records/enrichment-jobs/:jobId/cancel", enrichmentRateLimit, records.cancelEnrichment);
router.post("/records/:recordId/mapping-options", records.createOption);
router.delete("/records/:recordId/mapping-options/:mappingOptionId", records.removeOption);

// FORUMS
router.get("/forums/duplicates", forums.listDuplicates);
router.post("/forums/merge", forums.mergeForums);

// MAPPING QUESTIONS
router.get("/mapping-questions", mappingQuestions.listing);
router.post("/mapping-questions", mappingQuestions.create);
router.put("/mapping-questions/:id", mappingQuestions.update);
router.delete("/mapping-questions/:id", mappingQuestions.remove);
router.get("/mapping-questions/:id/mapping-options", mappingQuestions.listOptions);
router.post("/mapping-questions/:id/mapping-options", mappingQuestions.createOption);
router.put("/mapping-questions/:id/mapping-options/:optionId", mappingQuestions.updateOption);
router.delete("/mapping-questions/:id/mapping-options/:optionId", mappingQuestions.removeOption);

export default router;
