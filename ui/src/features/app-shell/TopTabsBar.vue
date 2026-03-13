<template>
  <div class="app-name">
    <ul class="app-tabs">
      <TabButton :class="['app-tab', tab === 'inc-exc' && 'app-tab--active']" :active="tab === 'inc-exc'" @click="emit('update-tab', 'inc-exc')">
        Include/exclude literature
      </TabButton>
      <TabButton :class="['app-tab', tab === 'map' && 'app-tab--active']" :active="tab === 'map'" @click="emit('update-tab', 'map')">
        Map literature
      </TabButton>
      <TabButton :class="['app-tab', tab === 'data' && 'app-tab--active']" :active="tab === 'data'" @click="emit('update-tab', 'data')">
        Data
      </TabButton>
    </ul>

    <div class="profile-controls">
      <select
        id="activeProfileSelect"
        class="profile-controls__select"
        :value="selectedProfileValue"
        :disabled="loading"
        aria-label="Active profile"
        @change="onProfileChange"
      >
        <option :value="CANONICAL_VIEW_VALUE">Canonical (resolved data)</option>
        <option v-for="profile in profiles" :key="profile.id" :value="profile.id">
          {{ profile.name }}
        </option>
      </select>
      <button type="button" class="profile-controls__button" @click="emit('manage-profiles')">
        Manage
      </button>
      <button
        type="button"
        class="profile-controls__button profile-controls__button--save"
        :disabled="snapshotDisabled"
        @click="emit('save-snapshot')"
      >
        <span v-if="snapshotSaving" class="profile-controls__spinner" aria-hidden="true" />
        {{ snapshotLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TabMode } from "../../stores/types";
import type { UserProfile } from "../../helpers/api";
import TabButton from "../../components/ui/TabButton.vue";

const CANONICAL_VIEW_VALUE = "canonical";

const props = defineProps<{
  tab: TabMode;
  profiles: UserProfile[];
  activeProfileId: number | null;
  loading: boolean;
  snapshotSaving: boolean;
  snapshotDisabled: boolean;
  snapshotLabel: string;
}>();

const selectedProfileValue = computed(() =>
  props.activeProfileId === null ? CANONICAL_VIEW_VALUE : String(props.activeProfileId));

const emit = defineEmits<{
  "update-tab": [value: TabMode];
  "profile-change": [value: number | null];
  "manage-profiles": [];
  "save-snapshot": [];
}>();

const onProfileChange = (event: Event) => {
  const rawValue = (event.target as HTMLSelectElement).value;
  if (rawValue === CANONICAL_VIEW_VALUE) {
    emit("profile-change", null);
    return;
  }
  const profileId = Number.parseInt(rawValue, 10);
  if (Number.isNaN(profileId)) {
    emit("profile-change", null);
    return;
  }
  emit("profile-change", profileId);
};
</script>

<style scoped lang="scss">
.profile-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.profile-controls__select {
  min-width: 180px;
}

.profile-controls__button {
  white-space: nowrap;
}

.profile-controls__button--save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 120px;
  justify-content: center;
}

.profile-controls__spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.22);
  border-top-color: rgba(0, 0, 0, 0.75);
  animation: profile-save-spin 0.75s linear infinite;
}

@keyframes profile-save-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
