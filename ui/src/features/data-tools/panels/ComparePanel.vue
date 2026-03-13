<template>
  <section class="compare-tools">
    <header class="compare-tools__header">
      <h3>Compare Assessments</h3>
      <p>Calculate agreement (Cohen's Kappa + agreement %) and resolve disagreements manually.</p>
    </header>

    <div class="compare-tools__controls">
      <label>
        Users to compare
        <select multiple size="5" :value="selectedUserValues" @change="onUserSelectionChange">
          <option v-for="profile in profiles" :key="profile.id" :value="String(profile.id)">
            {{ profile.name }}
          </option>
        </select>
      </label>
      <button type="button" :disabled="compareLoading || compareUserIds.length < 2" @click="emit('run-compare')">
        {{ compareLoading ? "Running..." : "Run compare" }}
      </button>
    </div>

    <p v-if="compareError" class="compare-tools__error">{{ compareError }}</p>

    <section v-if="pairwise.length > 0" class="compare-tools__pairwise">
      <h4>Pairwise Metrics</h4>
      <table>
        <thead>
          <tr>
            <th>User A</th>
            <th>User B</th>
            <th>Shared Records</th>
            <th>Agreement %</th>
            <th>Cohen's Kappa</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pair in pairwise" :key="`${pair.userIdA}-${pair.userIdB}`">
            <td>{{ getUserName(pair.userIdA) }}</td>
            <td>{{ getUserName(pair.userIdB) }}</td>
            <td>{{ pair.sharedCount }}</td>
            <td>{{ pair.agreementPercent.toFixed(2) }}</td>
            <td>{{ pair.kappa.toFixed(4) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="disagreements.length > 0" class="compare-tools__disagreements">
      <h4>Disagreements ({{ disagreements.length }})</h4>
      <article v-for="row in disagreements" :key="row.recordId" class="compare-tools__row">
        <header>
          <strong>Record {{ row.recordId }}</strong>
          <span>
            {{ row.statusDisagreement ? "status " : "" }}
            {{ row.mappingDisagreement ? "mapping " : "" }}
            {{ row.commentDisagreement ? "comment " : "" }}
          </span>
        </header>

        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Mapping Option IDs</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="value in row.values" :key="`${row.recordId}-${value.userId}`">
              <td>{{ getUserName(value.userId) }}</td>
              <td>{{ formatStatus(value.status) }}</td>
              <td>{{ value.mappingOptionIds.join(", ") || "-" }}</td>
              <td>{{ value.comment || "-" }}</td>
            </tr>
          </tbody>
        </table>

        <div class="compare-tools__resolve">
          <label>
            Resolved status
            <select :value="getDraft(row.recordId).status" @change="onDraftStatusChange(row.recordId, $event)">
              <option value="null">Unset</option>
              <option value="uncertain">Uncertain</option>
              <option value="excluded">Excluded</option>
              <option value="included">Included</option>
            </select>
          </label>
          <label>
            Resolved mapping IDs
            <input
              :value="getDraft(row.recordId).mappingOptionIdsText"
              type="text"
              placeholder="e.g. 2,5,9"
              @input="onDraftMappingInput(row.recordId, $event)"
            />
          </label>
          <label>
            Resolved comment
            <input
              :value="getDraft(row.recordId).comment"
              type="text"
              placeholder="Manual resolution note/comment"
              @input="onDraftCommentInput(row.recordId, $event)"
            />
          </label>
          <button
            type="button"
            :disabled="resolvingRecordId === row.recordId"
            @click="resolveRow(row.recordId)"
          >
            {{ resolvingRecordId === row.recordId ? "Resolving..." : "Resolve to canonical" }}
          </button>
        </div>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type {
  AssessmentDisagreementItem,
  PairwiseAgreement,
  RecordStatus,
  UserProfile,
} from "@shared/contracts";

const props = defineProps<{
  profiles: UserProfile[];
  compareUserIds: number[];
  compareLoading: boolean;
  compareError: string | null;
  pairwise: PairwiseAgreement[];
  disagreements: AssessmentDisagreementItem[];
  resolvingRecordId: number | null;
}>();

const emit = defineEmits<{
  "update-users": [userIds: number[]];
  "run-compare": [];
  "resolve-record": [payload: { recordId: number; status: RecordStatus; comment: string | null; mappingOptionIds: number[] }];
}>();

type RowDraft = {
  status: "null" | "uncertain" | "excluded" | "included";
  comment: string;
  mappingOptionIdsText: string;
};

const draftByRecord = reactive<Record<number, RowDraft>>({});

watch(
  () => props.disagreements,
  (rows) => {
    for (const row of rows) {
      if (draftByRecord[row.recordId]) {
        continue;
      }
      const first = row.values[0];
      draftByRecord[row.recordId] = {
        status: first?.status === null ? "null" : (first?.status ?? "null"),
        comment: first?.comment ?? "",
        mappingOptionIdsText: first?.mappingOptionIds.join(",") ?? "",
      };
    }
  },
  { immediate: true },
);

const selectedUserValues = computed(() => props.compareUserIds.map((id) => String(id)));

const getUserName = (userId: number) => props.profiles.find((profile) => profile.id === userId)?.name ?? `User ${userId}`;

const formatStatus = (status: RecordStatus) => (status === null ? "Unset" : status);

const onUserSelectionChange = (event: Event) => {
  const selected = [...(event.target as HTMLSelectElement).selectedOptions].map((option) =>
    Number.parseInt(option.value, 10));
  emit("update-users", selected.filter((value) => Number.isInteger(value) && value > 0));
};

const parseMappingOptionIds = (raw: string) =>
  [...new Set(raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0))]
    .sort((left, right) => left - right);

const getDraft = (recordId: number): RowDraft => {
  const current = draftByRecord[recordId];
  if (current) {
    return current;
  }
  const created: RowDraft = {
    status: "null",
    comment: "",
    mappingOptionIdsText: "",
  };
  draftByRecord[recordId] = created;
  return created;
};

const onDraftStatusChange = (recordId: number, event: Event) => {
  const value = (event.target as HTMLSelectElement).value as RowDraft["status"];
  getDraft(recordId).status = value;
};

const onDraftMappingInput = (recordId: number, event: Event) => {
  getDraft(recordId).mappingOptionIdsText = (event.target as HTMLInputElement).value;
};

const onDraftCommentInput = (recordId: number, event: Event) => {
  getDraft(recordId).comment = (event.target as HTMLInputElement).value;
};

const resolveRow = (recordId: number) => {
  const draft = draftByRecord[recordId];
  if (!draft) {
    return;
  }
  emit("resolve-record", {
    recordId,
    status: draft.status === "null" ? null : draft.status,
    comment: draft.comment.trim().length === 0 ? null : draft.comment,
    mappingOptionIds: parseMappingOptionIds(draft.mappingOptionIdsText),
  });
};
</script>

<style scoped lang="scss">
.compare-tools {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compare-tools__header h3 {
  margin: 0 0 4px;
}

.compare-tools__header p {
  margin: 0;
  opacity: 0.85;
}

.compare-tools__controls {
  display: flex;
  gap: 10px;
  align-items: end;
}

.compare-tools__controls label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.compare-tools table {
  width: 100%;
  border-collapse: collapse;
}

.compare-tools th,
.compare-tools td {
  border: 1px solid var(--ui-border-subtle);
  padding: 6px;
  vertical-align: top;
}

.compare-tools__row {
  border: 1px solid var(--ui-border-subtle);
  border-radius: 8px;
  padding: 8px;
  background: #fff;
}

.compare-tools__row header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.compare-tools__resolve {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: 8px;
  margin-top: 8px;
}

.compare-tools__resolve label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.compare-tools__error {
  color: #9c1d1d;
}

@media (max-width: 980px) {
  .compare-tools__resolve {
    grid-template-columns: 1fr;
  }
}
</style>
