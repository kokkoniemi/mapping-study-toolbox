<template>
  <div class="data-tools__panel data-tools__panel--pdfs data-tools__panel--workspace">
    <div class="pdf-tools__header">
      <div>
        <h4>PDF evidence</h4>
        <p>Attach or prepare PDFs for selected records. This step works independently from keywording.</p>
      </div>
      <div class="pdf-tools__meta">
        <span>{{ selectedRecordCount }} selected</span>
        <button type="button" :disabled="pdfLoading" @click="emit('reload')">
          {{ pdfLoading ? "Loading..." : "Reload" }}
        </button>
      </div>
    </div>

    <p v-if="pdfError" class="pdf-tools__error">{{ pdfError }}</p>
    <p v-if="pdfMessage" class="pdf-tools__message">{{ pdfMessage }}</p>

    <div v-if="selectedRecords.length === 0" class="pdf-tools__empty">
      Select one or more records from the grid, then attach PDFs here.
    </div>

    <ul v-else class="pdf-tools__list">
      <li v-for="record in selectedRecords" :key="record.id" class="pdf-tools__item">
        <div class="pdf-tools__item-head">
          <div>
            <strong>#{{ record.id }} {{ record.title || "(untitled)" }}</strong>
            <div class="pdf-tools__status">
              <span v-if="recordDocuments[record.id]?.length">
                {{ recordDocuments[record.id]?.length }} document{{ recordDocuments[record.id]?.length === 1 ? "" : "s" }}
              </span>
              <span v-else>No PDF uploaded</span>
            </div>
          </div>

          <label class="pdf-tools__upload">
            <span>Upload PDF</span>
            <input type="file" accept="application/pdf,.pdf" :disabled="Boolean(uploadingRecordIds[record.id])" @change="emit('upload', record.id, $event)" />
          </label>
        </div>

        <ul v-if="recordDocuments[record.id]?.length" class="pdf-tools__documents">
          <li v-for="document in recordDocuments[record.id]" :key="document.id" class="pdf-tools__document">
            <div class="pdf-tools__document-meta">
              <strong>{{ document.originalFileName }}</strong>
              <span>{{ document.isActive ? "Active" : "History" }} / {{ document.extractionStatus }}</span>
              <span v-if="document.qualityStatus && document.qualityStatus !== 'pending'">
                quality {{ document.qualityStatus }}{{ document.qualityScore != null ? ` (${Math.round(document.qualityScore * 100)}%)` : "" }}
              </span>
              <span v-if="document.pageCount != null">{{ document.pageCount }} pages</span>
              <span v-if="document.sourceType !== 'unknown'">{{ document.sourceType }}</span>
              <span v-if="document.ocrUsed">OCR used{{ document.ocrConfidence != null ? ` (${document.ocrConfidence}%)` : "" }}</span>
              <span>{{ formatBytes(document.fileSize) }}</span>
              <span v-if="document.extractionWarnings?.length">{{ document.extractionWarnings.join(" | ") }}</span>
              <span v-if="document.extractionError">{{ document.extractionError }}</span>
            </div>
            <div class="pdf-tools__document-actions">
              <button
                type="button"
                :disabled="document.uploadStatus !== 'uploaded' || Boolean(extractingDocumentIds[document.id])"
                @click="emit('extract', record.id, document.id)"
              >
                {{ extractingDocumentIds[document.id] ? "Extracting..." : document.extractionStatus === "completed" ? "Re-extract" : "Extract text" }}
              </button>
              <button
                type="button"
                :disabled="document.uploadStatus !== 'uploaded' || Boolean(removingDocumentIds[document.id])"
                @click="emit('remove', record.id, document.id)"
              >
                {{ removingDocumentIds[document.id] ? "Removing..." : "Remove" }}
              </button>
            </div>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { RecordDocumentSummary } from "../../../helpers/api";

type SelectedRecord = {
  id: number;
  title: string | null;
};

defineProps<{
  selectedRecords: SelectedRecord[];
  selectedRecordCount: number;
  recordDocuments: Record<number, RecordDocumentSummary[]>;
  pdfLoading: boolean;
  pdfError: string;
  pdfMessage: string;
  uploadingRecordIds: Record<number, boolean>;
  extractingDocumentIds: Record<number, boolean>;
  removingDocumentIds: Record<number, boolean>;
}>();

const emit = defineEmits<{
  reload: [];
  upload: [recordId: number, event: Event];
  extract: [recordId: number, documentId: number];
  remove: [recordId: number, documentId: number];
}>();

const formatBytes = (value: number) => {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};
</script>
