<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";

import { defaultStore } from "./stores/default";
import Sidebar from "./components/Sidebar.vue";
import Classifier from "./components/Classifier.vue";
import DataTable from "./components/DataTable.vue";

const store = defaultStore();
const { nick, tab } = storeToRefs(store);

const nickname = computed({
  get() {
    return nick.value ?? "";
  },
  set(value: string) {
    store.updateNick(value || null);
  },
});

const updateTab = (value: "inc-exc" | "map" | "data") => {
  store.updateTab(value);
};
</script>

<template>
  <div id="app">
    <div class="app-name">
      <ul class="app-tabs">
        <li
          :class="{'app-tab--active': tab === 'inc-exc'}"
          class="app-tab"
          @click="updateTab('inc-exc')"
        >Include/exclude literature</li>
        <li
          :class="{'app-tab--active': tab === 'map'}"
          class="app-tab"
          @click="updateTab('map')"
        >Map literature</li>
        <li
          :class="{'app-tab--active': tab === 'data'}"
          class="app-tab"
          @click="updateTab('data')"
        >Data</li>
      </ul>
      <input type="text" :class="[!nick && 'empty']" placeholder="Nickname" v-model="nickname" />
    </div>
    <div class="main-container" v-if="nick && tab !== 'data'">
      <Sidebar />
      <Classifier />
    </div>
    <div v-else-if="nick" class="data-container">
      <DataTable />
    </div>
    <div v-else class="message">Start by typing your nickname or initials in the blinking box above</div>
  </div>
</template>

<style lang="scss">
:root {
  --layout-gutter: clamp(12px, 2vw, 28px);
  --layout-sidebar-width: clamp(220px, 18vw, 300px);
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 0 var(--layout-gutter) var(--layout-gutter);
}
.main-container {
  display: grid;
  grid-template-columns: var(--layout-sidebar-width) minmax(0, 1fr);
  gap: var(--layout-gutter);
  align-items: stretch;
  width: 100%;
  min-width: 0;
  min-height: 700px;
}

.data-container {
  width: 100%;
  min-width: 0;
  min-height: 700px;
}
.app-name {
  border-bottom: 1px solid #eaeaea;
  display: flex;
  gap: var(--layout-gutter);
  justify-content: space-between;
  align-items: flex-end;
  margin: 0 0 var(--layout-gutter);
  font-size: 22px;
  min-width: 0;

  input {
    margin-bottom: 5px;
    border: 0;
    padding: 5px;
    height: 20px;
    width: 100px;
    transition: background-color 0.2s ease-in, border-color 0.2s ease-in;
    font-family: "Times New Roman", Times, serif;
    font-style: italic;
    font-weight: 600;
    font-size: 14px;

    &:hover,
    &:focus {
      background: #f7f7f7;
    }

    &.empty {
      animation: blink 1.4s infinite;
    }
  }
}

.message {
  padding: 100px 10px;
  text-align: center;
}

.app-tabs {
  list-style: none;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.app-tab {
  display: inline-block;
  margin: 0 5px;
  padding: 5px 10px;
  font-size: 18px;
  color: #878787;
  transition: background-color 0.2s ease-in, border-color 0.2s ease-in;
  transform: translateY(1px);
  border: 0px solid transparent;
  border-width: 1px 1px 0 1px;

  &:hover {
    background-color: #f7f7f7;
    border-color: #eaeaea;
    cursor: pointer;
  }

  &--active {
    border-color: #eaeaea;
    background-color: #fff;
    color: inherit;

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
    background: #f7f7f7;
  }
  100% {
    background: auto;
  }
}

body {
  overflow-y: scroll;
}

@media (max-width: 768px) {
  #app {
    --layout-sidebar-width: 100%;
  }

  .main-container {
    grid-template-columns: 1fr;
  }

  .app-name {
    flex-direction: column;
    align-items: stretch;
  }

  .app-name input {
    width: 100%;
    box-sizing: border-box;
  }
}

button {
  border: 0;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  color: #2c3e50;
  font-weight: 600;
  padding: 5px 10px;

  &:hover {
    background: #eaeaea;
  }

  .icon {
    display: inline-block;
    padding-right: 4px;
    font-size: 12px;
  }

  &.button--danger {
    color: #7b0c27;
  }
}
</style>
