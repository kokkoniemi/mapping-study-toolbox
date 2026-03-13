import { defineStore } from "pinia";

import {
  userProfiles as userProfilesApi,
  type UpdateUserProfilePayload,
  type UserProfile,
} from "../helpers/api";

type UserProfilesState = {
  profiles: UserProfile[];
  activeProfileId: number | null;
  mode: "canonical" | "profile";
  loading: boolean;
  error: string | null;
};

export const useUserProfilesStore = defineStore("userProfiles", {
  persist: {
    pick: ["activeProfileId", "mode"],
  },
  state: (): UserProfilesState => ({
    profiles: [],
    activeProfileId: null,
    mode: "profile",
    loading: false,
    error: null,
  }),
  getters: {
    activeProfile: (state): UserProfile | null =>
      state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null,
    activeProfiles: (state): UserProfile[] => state.profiles.filter((profile) => profile.isActive),
    isCanonicalView: (state): boolean => state.mode === "canonical",
  },
  actions: {
    async fetchProfiles() {
      this.loading = true;
      this.error = null;
      try {
        const response = await userProfilesApi.index();
        this.profiles = response.data.users;

        if (this.mode === "canonical") {
          this.activeProfileId = null;
          return;
        }

        const hasActiveSelection =
          this.activeProfileId !== null
          && this.profiles.some((profile) => profile.id === this.activeProfileId && profile.isActive);

        if (!hasActiveSelection) {
          const firstActive = this.profiles.find((profile) => profile.isActive) ?? null;
          this.activeProfileId = firstActive?.id ?? null;
        }
      } catch (error) {
        console.error(error);
        this.error = "Failed to load user profiles.";
      } finally {
        this.loading = false;
      }
    },
    setActiveProfile(profileId: number | null) {
      if (profileId === null) {
        this.activeProfileId = null;
        this.mode = "canonical";
        return;
      }
      const exists = this.profiles.some((profile) => profile.id === profileId && profile.isActive);
      if (!exists) {
        return;
      }
      this.activeProfileId = profileId;
      this.mode = "profile";
    },
    async createProfile(name: string) {
      const response = await userProfilesApi.create({ name });
      this.profiles = [...this.profiles, response.data].sort((left, right) => left.name.localeCompare(right.name));
      if (this.mode === "profile" && this.activeProfileId === null && response.data.isActive) {
        this.activeProfileId = response.data.id;
      }
      return response.data;
    },
    async updateProfile(id: number, patch: UpdateUserProfilePayload) {
      const response = await userProfilesApi.update(id, patch);
      this.profiles = this.profiles.map((profile) => (profile.id === id ? response.data : profile));

      if (this.mode === "canonical") {
        this.activeProfileId = null;
        return response.data;
      }

      const activeProfile = this.profiles.find((profile) => profile.id === this.activeProfileId);
      if (!activeProfile || !activeProfile.isActive) {
        const firstActive = this.profiles.find((profile) => profile.isActive) ?? null;
        this.activeProfileId = firstActive?.id ?? null;
      }

      return response.data;
    },
  },
});
