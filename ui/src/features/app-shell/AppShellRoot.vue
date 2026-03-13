<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";

import { useUiStore } from "../../stores/ui";
import { useSnapshotsStore } from "../../stores/snapshots";
import { useRecordsStore } from "../../stores/records";
import { useUserProfilesStore } from "../../stores/userProfiles";
import type { TabMode } from "../../stores/types";
import TopTabsBar from "./TopTabsBar.vue";
import SidebarRoot from "../sidebar/SidebarRoot.vue";
import ClassifierRoot from "../classifier/ClassifierRoot.vue";

const DataToolsRoot = defineAsyncComponent(() => import("../data-tools/DataToolsRoot.vue"));

const uiStore = useUiStore();
const snapshotsStore = useSnapshotsStore();
const recordsStore = useRecordsStore();
const userProfilesStore = useUserProfilesStore();
const { tab } = storeToRefs(uiStore);
const {
  activeProfileId,
  activeProfiles,
  loading: profilesLoading,
  error: profilesError,
  profiles,
  isCanonicalView,
  canonicalEditingUnlocked,
} =
  storeToRefs(userProfilesStore);
const {
  activeSaving: snapshotSaving,
  isActiveSynced: snapshotSynced,
  pendingUploadCount: pendingUploadCount,
  pendingErrors: pendingUploadErrors,
  uploadFromFilesBusy: uploadFromFilesBusy,
} = storeToRefs(snapshotsStore);
const showProfileManager = ref(false);
const newProfileName = ref("");
const snapshotDisabled = computed(
  () => profilesLoading.value || !activeProfileId.value || snapshotSaving.value || snapshotSynced.value,
);
const snapshotButtonLabel = computed(() => {
  if (!activeProfileId.value) {
    return "Sync snapshot";
  }
  return snapshotSynced.value ? "Snapshot synced" : "Sync snapshot";
});
const uploadSnapshotsDisabled = computed(() => profilesLoading.value || uploadFromFilesBusy.value || pendingUploadCount.value <= 0);
const uploadSnapshotsLabel = computed(() =>
  pendingUploadCount.value > 0 ? `Upload to database (${pendingUploadCount.value})` : "Upload to database");

onMounted(async () => {
  await userProfilesStore.fetchProfiles();
  await snapshotsStore.refreshPendingUploads();
});

watch(
  activeProfileId,
  async (value, previousValue) => {
    const shouldReloadRecords = previousValue !== undefined && value !== previousValue;
    snapshotsStore.setActiveUser(value);
    await Promise.all([
      snapshotsStore.refreshPendingUploads(),
      ...(shouldReloadRecords ? [recordsStore.fetchPageItems(), recordsStore.loadInitialData()] : []),
    ]);
  },
  { immediate: true },
);

const updateTab = (value: TabMode) => {
  uiStore.updateTab(value);
};

const setActiveProfile = (value: number | null) => {
  userProfilesStore.setActiveProfile(value);
};

const toggleCanonicalEditing = () => {
  userProfilesStore.toggleCanonicalEditingUnlocked();
};

const createProfile = async () => {
  const name = newProfileName.value.trim();
  if (name.length === 0) {
    return;
  }
  try {
    await userProfilesStore.createProfile(name);
    newProfileName.value = "";
  } catch (error) {
    console.error(error);
  }
};

const renameProfile = async (id: number, currentName: string) => {
  const nextName = window.prompt("Rename profile", currentName);
  if (!nextName || nextName.trim().length === 0 || nextName.trim() === currentName) {
    return;
  }
  try {
    await userProfilesStore.updateProfile(id, { name: nextName.trim() });
  } catch (error) {
    console.error(error);
  }
};

const toggleProfileActive = async (id: number, isActive: boolean) => {
  try {
    await userProfilesStore.updateProfile(id, { isActive: !isActive });
  } catch (error) {
    console.error(error);
  }
};

const saveSnapshot = async () => {
  if (!activeProfileId.value) {
    return;
  }
  await snapshotsStore.saveNow(activeProfileId.value);
};

const uploadSnapshots = async () => {
  await snapshotsStore.uploadSnapshotsFromFiles();
};
</script>

<template>
  <div id="app">
    <TopTabsBar
      :tab="tab"
      :profiles="activeProfiles"
      :activeProfileId="activeProfileId"
      :isCanonicalView="isCanonicalView"
      :canonicalEditingUnlocked="canonicalEditingUnlocked"
      :loading="profilesLoading"
      :snapshotSaving="snapshotSaving"
      :snapshotDisabled="snapshotDisabled"
      :snapshotLabel="snapshotButtonLabel"
      @update-tab="updateTab"
      @profile-change="setActiveProfile"
      @manage-profiles="showProfileManager = !showProfileManager"
      @toggle-canonical-editing="toggleCanonicalEditing"
      @save-snapshot="saveSnapshot"
    />

    <section v-if="showProfileManager" class="profile-manager">
      <h3>User Profiles</h3>
      <p v-if="profilesError" class="profile-manager__error">{{ profilesError }}</p>
      <ul class="profile-manager__list">
        <li v-for="profile in profiles" :key="profile.id" class="profile-manager__item">
          <span :class="['profile-manager__name', !profile.isActive && 'profile-manager__name--inactive']">
            {{ profile.name }}
          </span>
          <div class="profile-manager__actions">
            <button type="button" @click="renameProfile(profile.id, profile.name)">Rename</button>
            <button type="button" @click="toggleProfileActive(profile.id, profile.isActive)">
              {{ profile.isActive ? "Deactivate" : "Activate" }}
            </button>
          </div>
        </li>
      </ul>
      <div class="profile-manager__create">
        <input v-model="newProfileName" type="text" placeholder="New profile name" />
        <button type="button" @click="createProfile">Create</button>
      </div>
      <div class="profile-manager__upload">
        <h4>Upload Snapshot Files</h4>
        <p>
          Imports newer assessment data from `snapshots/*.json` into the local database for each user.
        </p>
        <button
          type="button"
          class="profile-manager__upload-button"
          :disabled="uploadSnapshotsDisabled"
          @click="uploadSnapshots"
        >
          <span v-if="uploadFromFilesBusy" class="profile-manager__spinner" aria-hidden="true" />
          {{ uploadSnapshotsLabel }}
        </button>
        <p v-if="pendingUploadErrors.length > 0" class="profile-manager__error">
          {{ pendingUploadErrors.join(" | ") }}
        </p>
      </div>
    </section>

    <div v-if="tab !== 'data'" class="main-container">
      <SidebarRoot />
      <ClassifierRoot />
    </div>

    <div v-else class="data-container">
      <DataToolsRoot />
    </div>
  </div>
</template>

<style lang="scss">
:root {
  --layout-gutter: clamp(12px, 2vw, 28px);
  --layout-sidebar-width: clamp(220px, 18vw, 300px);
}

#app {
  font-family: var(--ui-font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--ui-text-primary);
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  padding: clamp(6px, 1vh, 10px) var(--layout-gutter) var(--layout-gutter);
}

.main-container {
  display: grid;
  grid-template-columns: var(--layout-sidebar-width) minmax(0, 1fr);
  gap: var(--layout-gutter);
  align-items: stretch;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.data-container {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.app-name {
  position: relative;
  border-bottom: 1px solid var(--ui-border-subtle);
  display: flex;
  gap: var(--layout-gutter);
  justify-content: space-between;
  align-items: flex-end;
  margin: 0 0 clamp(6px, 1vh, 10px);
  font-size: 20px;
  min-width: 0;
}

.app-tabs {
  list-style: none;
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-end;
  gap: 4px;
  padding: 0;
  margin: 0 0 -1px;
  min-width: 0;
  overflow-x: auto;
}

.app-tab {
  display: inline-block;
  margin: 0;
  padding: 5px 10px;
  font-size: 17px;
  color: var(--ui-text-muted);
  transition: background-color 0.2s ease-in, border-color 0.2s ease-in;
  transform: translateY(1px);
  position: relative;
  border: 0 solid transparent;
  border-width: 1px 1px 0 1px;

  &:hover {
    background-color: var(--ui-surface-subtle);
    border-color: var(--ui-border-subtle);
    cursor: pointer;
  }

  &--active {
    border-color: var(--ui-border-subtle);
    border-bottom-color: #fff;
    background-color: #fff;
    color: inherit;
    z-index: 2;

    &::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 3px;
      background: #fff;
    }

    &:hover {
      background-color: #fff;
    }
  }
}

body {
  overflow: hidden;
}

.profile-manager {
  border: 1px solid var(--ui-border-subtle);
  background: var(--ui-surface-subtle);
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 8px;
}

.profile-manager__list {
  list-style: none;
  padding: 0;
  margin: 0 0 10px;
}

.profile-manager__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 0;
}

.profile-manager__name--inactive {
  opacity: 0.6;
  text-decoration: line-through;
}

.profile-manager__actions {
  display: flex;
  gap: 6px;
}

.profile-manager__create {
  display: flex;
  gap: 8px;
}

.profile-manager__create input {
  flex: 1;
}

.profile-manager__upload {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ui-border-subtle);
}

.profile-manager__upload h4 {
  margin: 0 0 4px;
  font-size: 14px;
}

.profile-manager__upload p {
  margin: 0 0 8px;
  color: var(--ui-text-secondary);
  font-size: 12px;
}

.profile-manager__upload-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.profile-manager__spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.22);
  border-top-color: rgba(0, 0, 0, 0.75);
  animation: profile-manager-spin 0.75s linear infinite;
}

.profile-manager__error {
  color: #9c1d1d;
}

@keyframes profile-manager-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  body {
    overflow-y: auto;
  }

  #app {
    height: auto;
    --layout-sidebar-width: 100%;
    overflow: visible;
  }

  .main-container {
    grid-template-columns: 1fr;
  }

  .app-name {
    flex-direction: column;
    align-items: stretch;
  }

}
</style>
