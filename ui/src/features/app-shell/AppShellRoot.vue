<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { storeToRefs } from "pinia";

import { useUiStore } from "../../stores/ui";
import type { TabMode } from "../../stores/types";
import TopTabsBar from "./TopTabsBar.vue";
import SidebarRoot from "../sidebar/SidebarRoot.vue";
import ClassifierRoot from "../classifier/ClassifierRoot.vue";

const DataToolsRoot = defineAsyncComponent(() => import("../data-tools/DataToolsRoot.vue"));

const uiStore = useUiStore();
const { nick, tab } = storeToRefs(uiStore);

const nickname = computed({
  get: () => nick.value ?? "",
  set: (value: string) => {
    uiStore.updateNick(value || null);
  },
});

const updateTab = (value: TabMode) => {
  uiStore.updateTab(value);
};
</script>

<template>
  <div id="app">
    <TopTabsBar :tab="tab" :nickname="nickname" @update-tab="updateTab" @update-nickname="nickname = $event" />

    <div v-if="nick && tab !== 'data'" class="main-container">
      <SidebarRoot />
      <ClassifierRoot />
    </div>

    <div v-else-if="nick" class="data-container">
      <DataToolsRoot />
    </div>

    <div v-else class="message">
      Start by typing your nickname or initials in the blinking box above
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

.nickname-input {
  flex: 0 0 auto;
  width: clamp(108px, 11vw, 150px);
  min-width: 108px;
  max-width: 150px;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 12px;
  font-weight: 600;
}

.app-name .nickname-input {
  width: clamp(108px, 11vw, 150px);
}

.nickname-input.empty {
  animation: blink 1.4s infinite;
}

.message {
  padding: 100px 10px;
  text-align: center;
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

@keyframes blink {
  0% {
    background: transparent;
  }
  50% {
    background: var(--ui-surface-subtle);
  }
  100% {
    background: auto;
  }
}

body {
  overflow: hidden;
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

  .app-name .nickname-input {
    width: 100%;
    max-width: none;
  }
}
</style>

