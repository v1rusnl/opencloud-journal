<template>
  <div class="cal-dialog-overlay" @click.self="$emit('close')">
    <div class="cal-dialog">
      <h2>{{ t('New Calendar') }}</h2>

      <label>
        {{ t('Calendar name') }}
        <input v-model="name" type="text" :placeholder="t('Calendar name')" autofocus />
      </label>

      <label>
        {{ t('Color') }}
        <input v-model="color" type="color" />
      </label>

      <div class="actions">
        <button @click="$emit('close')">{{ t('Cancel') }}</button>
        <button class="primary" @click="handleCreate">{{ t('Create') }}</button>
      </div>

      <p v-if="error" class="error-msg">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'create', name: string, color: string): void
  (e: 'close'): void
}>()

const name = ref('')
const color = ref('#0082c9')
const error = ref<string | null>(null)

function handleCreate() {
  error.value = null
  if (!name.value.trim()) { error.value = t('Calendar name') + ' ' + t('is required.'); return }
  emit('create', name.value.trim(), color.value)
}
</script>

<style scoped>
.cal-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.cal-dialog {
  background: var(--oc-role-surface, #fff);
  color: var(--oc-role-on-surface, #1a1a1a);
  border: 1px solid var(--oc-role-outline-variant, #ddd);
  border-radius: 8px;
  padding: 1.5rem;
  width: 360px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.35);
}

h2 {
  margin: 0;
  font-size: 1.2rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--oc-role-on-surface-variant, #666);
}

input[type='text'] {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--oc-role-outline-variant, #ccc);
  border-radius: 4px;
  font-size: 0.95rem;
  font-family: inherit;
  background: var(--oc-role-surface-container-high, #f5f5f5);
  color: var(--oc-role-on-surface, #1a1a1a);
}

input[type='text']:focus {
  outline: none;
  border-color: var(--oc-role-primary, #0082c9);
  box-shadow: 0 0 0 2px rgba(0, 130, 201, 0.25);
}

input[type='color'] {
  width: 48px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--oc-role-outline-variant, #ccc);
  border-radius: 4px;
  cursor: pointer;
  background: none;
}

.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.25rem;
}

button {
  padding: 0.4rem 1rem;
  border-radius: 4px;
  border: 1px solid var(--oc-role-outline-variant, #ccc);
  cursor: pointer;
  font-size: 0.9rem;
  font-family: inherit;
  background: var(--oc-role-surface-container-high, #f0f0f0);
  color: var(--oc-role-on-surface, #1a1a1a);
}

button:hover { background: var(--oc-role-surface-container-highest, #e0e0e0); }

button.primary {
  background: var(--oc-role-primary, #0082c9);
  color: var(--oc-role-on-primary, #fff);
  border-color: transparent;
}

button.primary:hover { opacity: 0.9; }

.error-msg {
  color: var(--oc-role-error, #e9322d);
  font-size: 0.85rem;
  margin: 0;
}
</style>
