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

    <input
      type="text"
      :class="['nickname-input', !nickname && 'empty']"
      placeholder="Nickname"
      :value="nickname"
      @input="onNicknameInput"
    />
  </div>
</template>

<script setup lang="ts">
import type { TabMode } from "../../stores/types";
import TabButton from "../../components/ui/TabButton.vue";

defineProps<{
  tab: TabMode;
  nickname: string;
}>();

const emit = defineEmits<{
  "update-tab": [value: TabMode];
  "update-nickname": [value: string];
}>();

const onNicknameInput = (event: Event) => {
  emit("update-nickname", (event.target as HTMLInputElement).value);
};
</script>
