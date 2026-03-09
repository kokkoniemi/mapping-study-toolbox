import { Router } from "express";

import * as records from "./records";
import * as mappingQuestions from "./mappingQuestions";

const router = Router();

router.get("/health", (_req, res) => {
  res.send({ status: "ok" });
});

// RECORDS
router.get("/records", records.listing);
router.get("/records/:id", records.get);
router.patch("/records/:id", records.patch);
router.put("/records/:id", records.update);
router.post("/records/enrichment-jobs", records.createEnrichment);
router.get("/records/enrichment-jobs/:jobId", records.getEnrichment);
router.post("/records/:recordId/mapping-options", records.createOption);
router.delete("/records/:recordId/mapping-options/:mappingOptionId", records.removeOption);

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
