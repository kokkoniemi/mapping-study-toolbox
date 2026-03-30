import { defineStore } from "pinia";
import type { ExportFormat, ExportScope } from "@shared/contracts";

export type DataToolsTab = "enrichment" | "export" | "forums" | "imports" | "pdfs" | "keywording" | "compare";
export type ImportViewMode = "history" | "wizard";
export type ImportWizardStep = 1 | 2 | 3 | 4;

type DataToolsState = {
  toolsTab: DataToolsTab;
  selectedRecordIds: number[];
  exportScope: ExportScope;
  exportFormat: ExportFormat;
  exportSelectedCsvFields: string[];
  exportSelectedBibtexFields: string[];
  exportCsvFieldsTouched: boolean;
  exportBibtexFieldsTouched: boolean;
  importViewMode: ImportViewMode;
  importWizardStep: ImportWizardStep;
};

export const useDataToolsStore = defineStore("dataTools", {
  state: (): DataToolsState => ({
    toolsTab: "enrichment",
    selectedRecordIds: [],
    exportScope: "all_filtered",
    exportFormat: "csv",
    exportSelectedCsvFields: [],
    exportSelectedBibtexFields: [],
    exportCsvFieldsTouched: false,
    exportBibtexFieldsTouched: false,
    importViewMode: "history",
    importWizardStep: 1,
  }),
  actions: {
    setToolsTab(payload: DataToolsTab) {
      this.toolsTab = payload;
    },
    setSelectedRecordIds(payload: number[]) {
      this.selectedRecordIds = payload;
    },
    clearSelectedRecordIds() {
      this.selectedRecordIds = [];
    },
    toggleRecordSelection(recordId: number) {
      if (this.selectedRecordIds.includes(recordId)) {
        this.selectedRecordIds = this.selectedRecordIds.filter((id) => id !== recordId);
        return;
      }
      this.selectedRecordIds = [...this.selectedRecordIds, recordId];
    },
    setExportScope(payload: ExportScope) {
      this.exportScope = payload;
    },
    setExportFormat(payload: ExportFormat) {
      this.exportFormat = payload;
    },
    setImportViewMode(payload: ImportViewMode) {
      this.importViewMode = payload;
    },
    setImportWizardStep(payload: ImportWizardStep) {
      this.importWizardStep = payload;
    },
  },
});
