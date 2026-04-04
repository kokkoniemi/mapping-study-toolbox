import { Router } from "express";

import { createRateLimitMiddleware } from "../lib/security";
import * as records from "./records";
import * as mappingQuestions from "./mappingQuestions";
import * as forums from "./forums";
import * as imports from "./imports";
import * as users from "./users";
import * as assessments from "./assessments";
import * as snapshots from "./snapshots";
import * as recordDocuments from "./recordDocuments";
import * as keywording from "./keywording";

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

// USER PROFILES
router.get("/users", users.listing);
router.post("/users", users.create);
router.patch("/users/:id", users.update);

// USER ASSESSMENTS
router.get("/assessments/records", assessments.listRecords);
router.get("/assessments", assessments.listing);
router.post("/assessments/compare", assessments.compare);
router.get("/assessments/:recordId", assessments.get);
router.put("/assessments/:recordId", assessments.upsert);
router.put("/assessments/:recordId/resolve", assessments.resolve);

// SNAPSHOTS
router.get("/snapshots/export", snapshots.exportUserSnapshot);
router.post("/snapshots/save", snapshots.saveUserSnapshot);
router.post("/snapshots/import", snapshots.importUserSnapshot);
router.get("/snapshots/pending", snapshots.pendingSnapshotUploads);
router.post("/snapshots/upload", snapshots.uploadSnapshotFiles);

// RECORDS
router.get("/records", records.listing);
router.get("/records/:id", records.get);
router.patch("/records/:id", records.patch);
router.put("/records/:id", records.update);
router.get("/records/:recordId/documents", recordDocuments.listing);
router.get("/records/:recordId/documents/:documentId", recordDocuments.get);
router.post("/records/:recordId/documents", recordDocuments.upload);
router.delete("/records/:recordId/documents/:documentId", recordDocuments.remove);
router.post("/records/:recordId/documents/:documentId/extract", recordDocuments.extract);
router.post("/records/export", records.exportRecords);
router.post("/records/enrichment-jobs", enrichmentRateLimit, records.createEnrichment);
router.get("/records/enrichment-jobs/:jobId", records.getEnrichment);
router.post("/records/enrichment-jobs/:jobId/cancel", enrichmentRateLimit, records.cancelEnrichment);
router.post("/records/:recordId/mapping-options", records.createOption);
router.delete("/records/:recordId/mapping-options/:mappingOptionId", records.removeOption);

// KEYWORDING
router.get("/keywording-jobs", keywording.listing);
router.post("/keywording-jobs", keywording.create);
router.get("/keywording-jobs/:jobId", keywording.get);
router.post("/keywording-jobs/:jobId/cancel", keywording.cancel);
router.delete("/keywording-jobs/:jobId", keywording.remove);
router.get("/keywording-jobs/:jobId/report", keywording.report);

// FORUMS
router.get("/forums/duplicates", forums.listDuplicates);
router.post("/forums/merge", forums.mergeForums);

// IMPORTS
router.get("/imports", imports.listing);
router.post("/imports/preview", imports.preview);
router.post("/imports", imports.create);
router.delete("/imports/:id", imports.remove);

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
