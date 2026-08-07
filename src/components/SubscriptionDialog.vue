<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <h2>{{ t('Add Subscription') }}</h2>

      <label>
        {{ t('Name') }}
        <input v-model="form.name" type="text" :placeholder="t('e.g. Public Holidays')" />
      </label>

      <label>
        {{ t('iCal URL (.ics)') }}
        <input v-model="form.url" type="url" placeholder="https://example.com/calendar.ics" />
      </label>

      <label>
        {{ t('Color') }}
        <input v-model="form.color" type="color" />
      </label>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <div class="dialog-actions">
        <button @click="$emit('close')">{{ t('Cancel') }}</button>
        <button class="primary" :disabled="!canSave" @click="submit">{{ t('Add') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { canonicalFeedUrl } from '@/utils/subscriptionUrl'

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'add', url: string, name: string, color: string): void
  (e: 'close'): void
}>()

const form = reactive({ url: '', name: '', color: '#e67e22' })
const error = ref('')

const canSave = computed(() => {
  const u = form.url.trim()
  return (u.startsWith('http') || u.startsWith('webcal://')) && form.name.trim().length > 0
})

function normalizeUrl(raw: string): string {
  let url = raw.trim()
  if (url.startsWith('webcal://')) url = 'https://' + url.slice('webcal://'.length)
  try {
    const cid = new URL(url).searchParams.get('cid')
    if (cid) url = cid
  } catch { /* leave as-is */ }
  // Skip Google's 302 hop: clients that do not follow redirects otherwise
  // subscribe successfully and then show an empty calendar.
  return canonicalFeedUrl(url)
}

function submit() {
  error.value = ''
  const normalized = normalizeUrl(form.url)
  try {
    new URL(normalized)
  } catch {
    error.value = 'Please enter a valid URL.'
    return
  }
  emit('add', normalized, form.name.trim(), form.color)
  emit('close')
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--oc-role-surface, #fff);
  border-radius: 8px;
  padding: 24px;
  min-width: 340px;
  max-width: 480px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
}

h2 {
  margin: 0;
  font-size: 1.1rem;
  color: inherit;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  color: inherit;
}

input[type='text'],
input[type='url'] {
  padding: 6px 8px;
  border: 1px solid var(--oc-role-outline-variant, #ddd);
  border-radius: 4px;
  background: var(--oc-role-surface-container-high, #f5f5f5);
  color: inherit;
  font-size: 0.9rem;
}

input[type='color'] {
  width: 48px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.error-msg {
  color: var(--oc-role-error, #c0392b);
  font-size: 0.85rem;
  margin: 0;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

button {
  padding: 6px 16px;
  border-radius: 4px;
  border: 1px solid var(--oc-role-outline-variant, #ddd);
  background: var(--oc-role-surface-container-high, #f5f5f5);
  color: inherit;
  cursor: pointer;
  font-size: 0.9rem;
}

button.primary {
  background: var(--oc-role-primary, #0082c9);
  color: var(--oc-role-on-primary, #fff);
  border-color: transparent;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
