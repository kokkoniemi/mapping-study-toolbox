import { defineStore } from "pinia";

import { getApiErrorMessage } from "../helpers/errors";
import { snapshots } from "../helpers/api";

const AUTO_SAVE_DEBOUNCE_MS = 5_000;

type SnapshotUserState = {
  dirtyRevision: number;
  syncedRevision: number;
  saving: boolean;
  pending: boolean;
  error: string | null;
  lastSavedAt: string | null;
  lastSavedPath: string | null;
  lastChanged: boolean | null;
};

type SnapshotStoreState = {
  activeUserId: number | null;
  users: Record<number, SnapshotUserState>;
  pendingUploads: number;
  pendingErrors: string[];
  uploadFromFilesRunning: boolean;
};

const autosaveTimers = new Map<number, ReturnType<typeof setTimeout>>();

const createInitialUserState = (): SnapshotUserState => ({
  dirtyRevision: 0,
  syncedRevision: 0,
  saving: false,
  pending: false,
  error: null,
  lastSavedAt: null,
  lastSavedPath: null,
  lastChanged: null,
});

export const useSnapshotsStore = defineStore("snapshots", {
  state: (): SnapshotStoreState => ({
    activeUserId: null,
    users: {},
    pendingUploads: 0,
    pendingErrors: [],
    uploadFromFilesRunning: false,
  }),
  getters: {
    activeState: (state): SnapshotUserState => {
      if (!state.activeUserId) {
        return createInitialUserState();
      }
      return state.users[state.activeUserId] ?? createInitialUserState();
    },
    activeSaving(): boolean {
      return this.activeState.saving;
    },
    activePending(): boolean {
      return this.activeState.pending;
    },
    activeError(): string | null {
      return this.activeState.error;
    },
    isActiveSynced(): boolean {
      const state = this.activeState;
      return state.error === null
        && !state.saving
        && !state.pending
        && state.dirtyRevision === state.syncedRevision;
    },
    pendingUploadCount(state): number {
      return state.pendingUploads;
    },
    uploadFromFilesBusy(state): boolean {
      return state.uploadFromFilesRunning;
    },
  },
  actions: {
    getOrCreateUserState(userId: number) {
      const current = this.users[userId];
      if (current) {
        return current;
      }

      const next = createInitialUserState();
      this.users = {
        ...this.users,
        [userId]: next,
      };
      return next;
    },
    setActiveUser(userId: number | null) {
      this.activeUserId = userId;
      if (userId && !this.users[userId]) {
        this.getOrCreateUserState(userId);
      }
    },
    scheduleAutoSave(userId: number | null) {
      if (userId === null || !Number.isInteger(userId) || userId <= 0) {
        return;
      }
      const targetUserId = userId;

      const state = this.getOrCreateUserState(targetUserId);
      state.dirtyRevision += 1;
      state.pending = true;
      state.error = null;

      const currentTimer = autosaveTimers.get(targetUserId);
      if (currentTimer) {
        clearTimeout(currentTimer);
      }

      const timer = setTimeout(() => {
        autosaveTimers.delete(targetUserId);
        state.pending = false;
        void this.saveNow(targetUserId, { fromAuto: true });
      }, AUTO_SAVE_DEBOUNCE_MS);
      autosaveTimers.set(targetUserId, timer);
    },
    cancelAutoSave(userId: number | null) {
      if (userId === null || !Number.isInteger(userId) || userId <= 0) {
        return;
      }
      const targetUserId = userId;

      const timer = autosaveTimers.get(targetUserId);
      if (timer) {
        clearTimeout(timer);
        autosaveTimers.delete(targetUserId);
      }

      const state = this.users[targetUserId];
      if (state) {
        state.pending = false;
      }
    },
    async saveNow(userId: number, options?: { fromAuto?: boolean }) {
      if (!Number.isInteger(userId) || userId <= 0) {
        return;
      }

      const state = this.getOrCreateUserState(userId);

      if (state.saving) {
        if (!options?.fromAuto) {
          state.pending = true;
          const currentTimer = autosaveTimers.get(userId);
          if (!currentTimer) {
            const timer = setTimeout(() => {
              autosaveTimers.delete(userId);
              state.pending = false;
              void this.saveNow(userId, { fromAuto: true });
            }, AUTO_SAVE_DEBOUNCE_MS);
            autosaveTimers.set(userId, timer);
          }
        }
        return;
      }

      const timer = autosaveTimers.get(userId);
      if (timer) {
        clearTimeout(timer);
        autosaveTimers.delete(userId);
      }

      const targetRevision = state.dirtyRevision;
      state.pending = false;
      state.error = null;
      state.saving = true;

      try {
        const response = await snapshots.saveUser({ userId });
        state.lastSavedAt = response.data.savedAt;
        state.lastSavedPath = response.data.path;
        state.lastChanged = response.data.changed;

        if (state.dirtyRevision === targetRevision) {
          state.syncedRevision = targetRevision;
          state.pending = false;
        } else {
          state.pending = true;
          const retryTimer = setTimeout(() => {
            autosaveTimers.delete(userId);
            state.pending = false;
            void this.saveNow(userId, { fromAuto: true });
          }, AUTO_SAVE_DEBOUNCE_MS);
          autosaveTimers.set(userId, retryTimer);
        }
        await this.refreshPendingUploads();
      } catch (error) {
        state.error = getApiErrorMessage(error);
      } finally {
        state.saving = false;
      }
    },
    async refreshPendingUploads() {
      try {
        const response = await snapshots.pendingUploads();
        this.pendingUploads = response.data.pendingSnapshots;
        this.pendingErrors = response.data.errors ?? [];
      } catch (error) {
        this.pendingErrors = [getApiErrorMessage(error)];
      }
    },
    async uploadSnapshotsFromFiles() {
      if (this.uploadFromFilesRunning) {
        return;
      }
      this.uploadFromFilesRunning = true;
      try {
        const response = await snapshots.uploadSnapshots();
        if (response.data.errors.length > 0) {
          const activeState = this.activeUserId ? this.getOrCreateUserState(this.activeUserId) : null;
          if (activeState) {
            activeState.error = `Snapshot upload finished with errors: ${response.data.errors.join(" | ")}`;
          }
        }
        await this.refreshPendingUploads();
      } catch (error) {
        const activeState = this.activeUserId ? this.getOrCreateUserState(this.activeUserId) : null;
        if (activeState) {
          activeState.error = getApiErrorMessage(error);
        }
      } finally {
        this.uploadFromFilesRunning = false;
      }
    },
  },
});
