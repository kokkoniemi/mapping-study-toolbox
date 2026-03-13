<template>
  <section class="compare-tools">
    <header class="compare-tools__header">
      <h3>Compare Assessments</h3>
      <p>Calculate agreement (Cohen's Kappa + 95% CI + agreement %) and resolve disagreements manually.</p>
    </header>

    <div class="compare-tools__controls">
      <label>
        Users to compare
        <div class="compare-tools__user-list">
          <label
            v-for="profile in profiles"
            :key="profile.id"
            class="compare-tools__user-option"
          >
            <input
              type="checkbox"
              :checked="isUserSelected(profile.id)"
              @change="toggleUserSelection(profile.id, $event)"
            />
            <span>{{ profile.name }}</span>
          </label>
        </div>
      </label>
      <button type="button" :disabled="compareLoading || compareUserIds.length < 2" @click="emit('run-compare')">
        {{ compareLoading ? "Running..." : "Run compare" }}
      </button>
    </div>

    <p v-if="compareError" class="compare-tools__error">{{ compareError }}</p>

    <section v-if="pairwise.length > 0" class="compare-tools__pairwise">
      <h4>Pairwise Metrics</h4>
      <p class="compare-tools__pairwise-note">Metrics are calculated using shared records only and shown per metric row.</p>
      <table>
        <thead>
          <tr>
            <th>User A</th>
            <th>User B</th>
            <th>Metric</th>
            <th>Shared Records</th>
            <th>Agreement %</th>
            <th>Cohen's Kappa</th>
            <th>Kappa 95% CI</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pair in pairwise" :key="`${pair.userIdA}-${pair.userIdB}-${pair.metricKey}`">
            <td>{{ getUserName(pair.userIdA) }}</td>
            <td>{{ getUserName(pair.userIdB) }}</td>
            <td>{{ pair.metricLabel }}</td>
            <td>{{ pair.sharedCount }}</td>
            <td>{{ pair.agreementPercent.toFixed(2) }}</td>
            <td>{{ pair.kappa.toFixed(4) }}</td>
            <td>{{ formatKappaCi95(pair.kappaCi95Lower, pair.kappaCi95Upper) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="disagreements.length > 0" class="compare-tools__disagreements">
      <h4>Disagreements ({{ disagreements.length }})</h4>
      <article v-for="row in disagreements" :key="row.recordId" class="compare-tools__row">
        <header class="compare-tools__row-header">
          <div class="compare-tools__row-title">
            <strong>Record {{ row.recordId }}</strong>
            <span>
              {{ row.statusDisagreement ? "status " : "" }}
              {{ row.mappingDisagreement ? "mapping " : "" }}
            </span>
          </div>
          <button
            type="button"
            class="compare-tools__row-edit"
            :disabled="resolvingRecordId === row.recordId"
            @click="toggleResolveEditor(row.recordId)"
          >
            {{ isResolveEditorOpen(row.recordId) ? "Hide resolve" : "Edit resolve" }}
          </button>
        </header>

        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Mapping Selections</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="value in row.values" :key="`${row.recordId}-${value.userId}`">
              <td>{{ getUserName(value.userId) }}</td>
              <td>{{ formatStatus(value.status) }}</td>
              <td>
                <span v-if="value.mappingOptionIds.length === 0">-</span>
                <div v-else class="compare-tools__mapping-groups">
                  <div
                    v-for="group in getMappingGroups(value.mappingOptionIds)"
                    :key="`${row.recordId}-${value.userId}-${group.questionId}`"
                    class="compare-tools__mapping-group"
                  >
                    <div class="compare-tools__mapping-question">{{ group.questionLabel }}</div>
                    <div class="compare-tools__mapping-chips">
                      <span
                        v-for="option in group.options"
                        :key="option.id"
                        class="compare-tools__mapping-chip"
                        :class="group.unknown && 'compare-tools__mapping-chip--unknown'"
                        :style="group.unknown ? undefined : mappingChipStyle(option.color)"
                      >
                        {{ option.title }}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              <td>{{ value.comment || "-" }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="isResolveEditorOpen(row.recordId)" class="compare-tools__resolve">
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
            Resolved mapping options
            <div class="compare-tools__resolved-mapping">
              <div
                v-for="question in sortedMappingQuestions"
                :key="`resolved-${row.recordId}-${question.id}`"
                class="compare-tools__resolved-question"
              >
                <div class="compare-tools__mapping-question">{{ question.label }}</div>
                <div class="compare-tools__mapping-chips">
                  <button
                    v-for="option in getDraftOptionsForQuestion(row.recordId, question.id)"
                    :key="`resolved-${row.recordId}-${option.id}`"
                    type="button"
                    class="compare-tools__mapping-chip compare-tools__mapping-chip--selected"
                    :style="mappingChipStyle(option.color)"
                    @click="removeDraftMappingOption(row.recordId, option.id)"
                  >
                    {{ option.title }}
                    <span class="compare-tools__mapping-chip-remove">⊗</span>
                  </button>
                  <span
                    v-if="getDraftOptionsForQuestion(row.recordId, question.id).length === 0"
                    class="compare-tools__mapping-empty"
                  >
                    No selection
                  </span>
                </div>
                <select class="compare-tools__mapping-add" @change="addDraftMappingOption(row.recordId, $event)">
                  <option value="">+ Add option</option>
                  <option
                    v-for="option in getAvailableOptionsForQuestion(row.recordId, question.id)"
                    :key="`add-${row.recordId}-${question.id}-${option.id}`"
                    :value="option.id"
                  >
                    {{ option.title }}
                  </option>
                </select>
              </div>

              <div
                v-if="getUnknownDraftOptions(row.recordId).length > 0"
                class="compare-tools__resolved-question"
              >
                <div class="compare-tools__mapping-question">Unknown mapping question</div>
                <div class="compare-tools__mapping-chips">
                  <button
                    v-for="option in getUnknownDraftOptions(row.recordId)"
                    :key="`unknown-${row.recordId}-${option.id}`"
                    type="button"
                    class="compare-tools__mapping-chip compare-tools__mapping-chip--unknown compare-tools__mapping-chip--selected"
                    @click="removeDraftMappingOption(row.recordId, option.id)"
                  >
                    {{ option.title }}
                    <span class="compare-tools__mapping-chip-remove">⊗</span>
                  </button>
                </div>
              </div>
            </div>
          </label>
          <label>
            Resolved comment
            <textarea
              :value="getDraft(row.recordId).comment"
              rows="3"
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
import { buildMergedResolvedComment, formatKappaCi95 } from "./compareUtils";
import type { MappingQuestion } from "../../../helpers/api";
import { normalizeMappingColor } from "../../../constants/mapping";

const props = defineProps<{
  profiles: UserProfile[];
  mappingQuestions: MappingQuestion[];
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
  mappingOptionIds: number[];
};

const draftByRecord = reactive<Record<number, RowDraft>>({});
const resolveEditorOpenByRecord = reactive<Record<number, boolean>>({});
const getUserName = (userId: number) => props.profiles.find((profile) => profile.id === userId)?.name ?? `User ${userId}`;

type MappingGroupOption = {
  id: number;
  title: string;
  color: string | null;
};

type MappingGroup = {
  questionId: number;
  questionLabel: string;
  questionPosition: number;
  unknown: boolean;
  options: MappingGroupOption[];
};

type MappingQuestionMeta = {
  id: number;
  label: string;
  position: number;
  options: MappingGroupOption[];
};

const sortedMappingQuestions = computed<MappingQuestionMeta[]>(() =>
  [...props.mappingQuestions]
    .map((question) => ({
      id: question.id,
      label: question.title?.trim().length ? question.title.trim() : `Question ${question.id}`,
      position: Number.isInteger(question.position) ? question.position : Number.MAX_SAFE_INTEGER,
      options: [...(question.MappingOptions ?? [])]
        .map((option) => ({
          id: option.id,
          title: option.title?.trim().length ? option.title.trim() : `Option ${option.id}`,
          color: option.color ?? null,
          position: Number.isInteger(option.position) ? option.position : Number.MAX_SAFE_INTEGER,
        }))
        .sort((left, right) => left.position - right.position || left.title.localeCompare(right.title))
        .map(({ id, title, color }) => ({ id, title, color })),
    }))
    .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label)),
);

const mappingQuestionMetaById = computed(() => {
  const map = new Map<number, MappingQuestionMeta>();
  for (const question of sortedMappingQuestions.value) {
    map.set(question.id, question);
  }
  return map;
});

const mappingOptionMetaById = computed(() => {
  const map = new Map<number, { title: string; color: string | null; questionId: number; questionLabel: string; questionPosition: number }>();
  for (const question of sortedMappingQuestions.value) {
    for (const option of question.options) {
      map.set(option.id, {
        title: option.title,
        color: option.color,
        questionId: question.id,
        questionLabel: question.label,
        questionPosition: question.position,
      });
    }
  }
  return map;
});

watch(
  () => props.disagreements,
  (rows) => {
    const activeRecordIds = new Set(rows.map((row) => row.recordId));
    for (const row of rows) {
      if (draftByRecord[row.recordId]) {
        continue;
      }
      const first = row.values[0];
      draftByRecord[row.recordId] = {
        status: first?.status === null ? "null" : (first?.status ?? "null"),
        comment: buildMergedResolvedComment(row.values, getUserName),
        mappingOptionIds: [...new Set(first?.mappingOptionIds ?? [])].sort((left, right) => left - right),
      };
    }

    for (const recordId of Object.keys(resolveEditorOpenByRecord).map((key) => Number.parseInt(key, 10))) {
      if (!activeRecordIds.has(recordId)) {
        delete resolveEditorOpenByRecord[recordId];
      }
    }

    for (const recordId of Object.keys(draftByRecord).map((key) => Number.parseInt(key, 10))) {
      if (!activeRecordIds.has(recordId)) {
        delete draftByRecord[recordId];
      }
    }
  },
  { immediate: true },
);

const formatStatus = (status: RecordStatus) => (status === null ? "Unset" : status);

const isUserSelected = (userId: number) => props.compareUserIds.includes(userId);

const toggleUserSelection = (userId: number, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  const selected = new Set(props.compareUserIds);
  if (checked) {
    selected.add(userId);
  } else {
    selected.delete(userId);
  }
  emit("update-users", [...selected].sort((left, right) => left - right));
};

const isResolveEditorOpen = (recordId: number) => Boolean(resolveEditorOpenByRecord[recordId]);

const toggleResolveEditor = (recordId: number) => {
  resolveEditorOpenByRecord[recordId] = !resolveEditorOpenByRecord[recordId];
};

const getMappingGroups = (mappingOptionIds: number[]): MappingGroup[] => {
  const sortedIds = [...new Set(mappingOptionIds)].sort((left, right) => left - right);
  const grouped = new Map<number, MappingGroup>();
  const unknownOptions: MappingGroupOption[] = [];

  for (const id of sortedIds) {
    const meta = mappingOptionMetaById.value.get(id);
    if (!meta) {
      unknownOptions.push({ id, title: `#${id}`, color: null });
      continue;
    }

    const existing = grouped.get(meta.questionId) ?? {
      questionId: meta.questionId,
      questionLabel: meta.questionLabel,
      questionPosition: meta.questionPosition,
      unknown: false,
      options: [],
    };
    existing.options.push({
      id,
      title: meta.title,
      color: meta.color,
    });
    grouped.set(meta.questionId, existing);
  }

  const groups = [...grouped.values()].sort((left, right) =>
    left.questionPosition - right.questionPosition || left.questionLabel.localeCompare(right.questionLabel));

  if (unknownOptions.length > 0) {
    groups.push({
      questionId: -1,
      questionLabel: "Unknown mapping question",
      questionPosition: Number.MAX_SAFE_INTEGER,
      unknown: true,
      options: unknownOptions,
    });
  }

  return groups;
};

const mappingChipStyle = (color: string | null) => ({
  backgroundColor: normalizeMappingColor(color),
});

const getDraftOptionsForQuestion = (recordId: number, questionId: number): MappingGroupOption[] => {
  const question = mappingQuestionMetaById.value.get(questionId);
  if (!question) {
    return [];
  }
  const selected = new Set(getDraft(recordId).mappingOptionIds);
  return question.options.filter((option) => selected.has(option.id));
};

const getAvailableOptionsForQuestion = (recordId: number, questionId: number): MappingGroupOption[] => {
  const question = mappingQuestionMetaById.value.get(questionId);
  if (!question) {
    return [];
  }
  const selected = new Set(getDraft(recordId).mappingOptionIds);
  return question.options.filter((option) => !selected.has(option.id));
};

const getUnknownDraftOptions = (recordId: number): MappingGroupOption[] =>
  getDraft(recordId).mappingOptionIds
    .filter((id) => !mappingOptionMetaById.value.has(id))
    .map((id) => ({
      id,
      title: `#${id}`,
      color: null,
    }));

const getDraft = (recordId: number): RowDraft => {
  const current = draftByRecord[recordId];
  if (current) {
    return current;
  }
  const created: RowDraft = {
    status: "null",
    comment: "",
    mappingOptionIds: [],
  };
  draftByRecord[recordId] = created;
  return created;
};

const onDraftStatusChange = (recordId: number, event: Event) => {
  const value = (event.target as HTMLSelectElement).value as RowDraft["status"];
  getDraft(recordId).status = value;
};

const addDraftMappingOption = (recordId: number, event: Event) => {
  const target = event.target as HTMLSelectElement;
  const optionId = Number.parseInt(target.value, 10);
  target.value = "";
  if (!Number.isInteger(optionId) || optionId <= 0) {
    return;
  }
  const draft = getDraft(recordId);
  draft.mappingOptionIds = [...new Set([...draft.mappingOptionIds, optionId])].sort((left, right) => left - right);
};

const removeDraftMappingOption = (recordId: number, optionId: number) => {
  const draft = getDraft(recordId);
  draft.mappingOptionIds = draft.mappingOptionIds.filter((id) => id !== optionId);
};

const onDraftCommentInput = (recordId: number, event: Event) => {
  getDraft(recordId).comment = (event.target as HTMLTextAreaElement).value;
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
    mappingOptionIds: [...draft.mappingOptionIds],
  });
};
</script>

<style scoped lang="scss">
.compare-tools {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  box-sizing: border-box;
  padding: 12px;
}

.compare-tools__header h3 {
  margin: 0 0 4px;
}

.compare-tools__header p {
  margin: 0;
  opacity: 0.85;
}

.compare-tools__pairwise-note {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--ui-text-secondary);
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

.compare-tools__user-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 4px;
  column-gap: 14px;
  row-gap: 6px;
  padding: 8px;
  border: 1px solid var(--ui-border-subtle);
  border-radius: var(--ui-radius-sm);
  background: var(--ui-surface-subtle);
}

.compare-tools__user-option {
  display: flex;
  align-items: center;
  gap: 8px;
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
  background: var(--ui-surface-subtle);
}

.compare-tools__row + .compare-tools__row {
  margin-top: 8px;
}

.compare-tools__row table,
.compare-tools__row th,
.compare-tools__row td {
  background: #fff;
}

.compare-tools__row header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.compare-tools__row-header {
  align-items: center;
  gap: 8px;
}

.compare-tools__row-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.compare-tools__row-edit {
  white-space: nowrap;
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

.compare-tools__resolved-mapping {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--ui-border-subtle);
  border-radius: var(--ui-radius-sm);
  padding: 8px;
  background: var(--ui-surface-subtle);
}

.compare-tools__resolved-question {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-tools__mapping-add {
  max-width: 320px;
}

.compare-tools__resolve textarea {
  resize: vertical;
  min-height: 64px;
}

.compare-tools__mapping-groups {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-tools__mapping-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.compare-tools__mapping-question {
  font-size: 11px;
  font-weight: 600;
  color: var(--ui-text-secondary);
}

.compare-tools__mapping-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.compare-tools__mapping-chip {
  display: inline-flex;
  align-items: center;
  min-height: 0;
  padding: 5px;
  border-radius: 3px;
  border: 0;
  font-size: 10px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.65);
}

.compare-tools__mapping-chip--selected {
  cursor: pointer;
}

.compare-tools__mapping-chip-remove {
  display: none;
  font-size: 14px;
  line-height: 1;
  margin-left: 3px;
}

.compare-tools__mapping-chip--selected:hover .compare-tools__mapping-chip-remove {
  display: inline-flex;
}

.compare-tools__mapping-chip--unknown {
  background: #eaeaea;
  color: var(--ui-text-secondary);
}

.compare-tools__mapping-empty {
  font-size: 11px;
  color: var(--ui-text-muted);
  font-style: italic;
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
