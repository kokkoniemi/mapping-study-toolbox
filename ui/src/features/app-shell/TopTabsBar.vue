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
      <label for="activeProfileSelect" class="profile-controls__label">Profile</label>
      <select
        id="activeProfileSelect"
        class="profile-controls__select"
        :value="activeProfileId ?? ''"
        :disabled="loading"
        @change="onProfileChange"
      >
        <option value="" disabled>{{ loading ? "Loading..." : "Select profile" }}</option>
        <option v-for="profile in profiles" :key="profile.id" :value="profile.id">
          {{ profile.name }}
        </option>
      </select>
      <button type="button" class="profile-controls__button" @click="emit('manage-profiles')">
        Manage
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TabMode } from "../../stores/types";
import type { UserProfile } from "../../helpers/api";
import TabButton from "../../components/ui/TabButton.vue";

defineProps<{
  tab: TabMode;
  profiles: UserProfile[];
  activeProfileId: number | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  "update-tab": [value: TabMode];
  "profile-change": [value: number | null];
  "manage-profiles": [];
}>();

const onProfileChange = (event: Event) => {
  const rawValue = (event.target as HTMLSelectElement).value;
  if (rawValue.length === 0) {
    emit("profile-change", null);
    return;
  }
  emit("profile-change", Number.parseInt(rawValue, 10));
};
</script>

<style scoped lang="scss">
.profile-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.profile-controls__label {
  font-size: 12px;
  opacity: 0.8;
}

.profile-controls__select {
  min-width: 180px;
}

.profile-controls__button {
  white-space: nowrap;
}
</style>
