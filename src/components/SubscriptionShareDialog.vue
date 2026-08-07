<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <h2>{{ subscription.name }}</h2>
      <p class="hint">{{ t('Scan this code to add the calendar on another device.') }}</p>

      <div class="scheme-switch" role="group">
        <button
          :class="{ active: scheme === 'webcal' }"
          @click="scheme = 'webcal'"
        >webcal://</button>
        <button
          :class="{ active: scheme === 'https' }"
          @click="scheme = 'https'"
        >https://</button>
      </div>

      <p class="hint">
        {{ scheme === 'webcal'
          ? t('Opens directly in a calendar app. Switch to https if your scanner ignores the link.')
          : t('A plain web link — your browser will show the raw calendar file.') }}
      </p>

      <!-- Deliberately black on white in both themes: a QR tinted to match dark
           mode loses contrast and many phone cameras stop recognising it. -->
      <div class="qr-tile">
        <canvas ref="qrCanvas" />
      </div>

      <label class="url-label">
        {{ t('iCal URL (.ics)') }}
        <input ref="urlInput" :value="shareUrl" readonly @focus="selectAll" />
      </label>

      <p v-if="copyState === 'failed'" class="hint warn">
        {{ t('Copying is unavailable here — select the address and copy it manually.') }}
      </p>

      <div class="dialog-actions">
        <button @click="$emit('close')">{{ t('Close') }}</button>
        <button class="primary" @click="copy">
          {{ copyState === 'copied' ? t('Copied') : t('Copy URL') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import QrCreator from 'qr-creator'
import { useI18n } from '@/composables/useI18n'
import { copyText } from '@/utils/clipboard'
import { toWebcalUrl, canonicalFeedUrl } from '@/utils/subscriptionUrl'
import type { IcsSubscription } from '@/composables/useSubscriptions'

const { t } = useI18n()

const props = defineProps<{ subscription: IcsSubscription }>()
defineEmits<{ (e: 'close'): void }>()

const qrCanvas = ref<HTMLCanvasElement | null>(null)
const urlInput = ref<HTMLInputElement | null>(null)
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')

// Both schemes are needed; neither works everywhere. Confirmed in practice:
// Android (ICSx⁵, DAVx⁵) only accepts webcal:// — an https QR is treated as a
// web link and the browser just shows raw iCalendar text. Thunderbird only
// accepts https://. webcal is the default because scanning is what the QR is
// for; the switch is not a convenience and must not be removed.
const scheme = ref<'webcal' | 'https'>('webcal')
// Canonicalised here as well as on add, so a subscription stored before that
// existed still hands out a URL the other device can actually fetch.
const shareUrl = computed(() => {
  const url = canonicalFeedUrl(props.subscription.url)
  return scheme.value === 'webcal' ? toWebcalUrl(url) : url
})

function renderQr() {
  if (!qrCanvas.value) return
  // Rendering into the canvas itself, not a wrapper: qr-creator appends a fresh
  // canvas when handed a plain element, so switching schemes would stack them.
  QrCreator.render(
    {
      text: shareUrl.value,
      // 'M' tolerates ~15 % damage — enough for a phone camera at an angle
      // without inflating the code for these fairly long feed URLs.
      ecLevel: 'M',
      // qr-creator defaults `quiet` to 0, but the spec requires a 4-module
      // margin; without it scanners get unreliable. Not left to the white tile
      // around the canvas, which is only worth about two modules.
      quiet: 4,
      // A ~110-character feed URL lands on a version-7 code: 45 modules, 53
      // across including the quiet zone, so 240 px gives 4.5 px per module.
      // Comfortably above the ~3 px phone cameras need; raise this if a longer
      // URL ever pushes the code to a higher version.
      size: 240,
      fill: '#000000',
      background: '#ffffff',
    },
    qrCanvas.value,
  )
}

onMounted(renderQr)
// Re-encode when the scheme is switched, and reset the copy feedback so the
// button never claims "Copied" for the variant that is no longer shown.
watch(shareUrl, () => {
  copyState.value = 'idle'
  renderQr()
})

function selectAll() {
  urlInput.value?.select()
}

async function copy() {
  copyState.value = (await copyText(shareUrl.value)) ? 'copied' : 'failed'
  if (copyState.value === 'failed') selectAll()
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
  min-width: 300px;
  max-width: 380px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  color: inherit;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
  color: inherit;
  overflow-wrap: anywhere;
}

.hint {
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.75;
}

.hint.warn {
  opacity: 1;
  color: var(--oc-role-error, #c0392b);
}

.qr-tile {
  align-self: center;
  /* Not themed on purpose. The canvas draws a black-on-white code, so the tile
     around it must stay white in both themes — a dark tile would swallow the
     quiet zone and phone cameras stop finding the code. */
  background: #fff;
  padding: 10px;
  border-radius: 6px;
  line-height: 0;
}

.url-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
}

input {
  padding: 6px 8px;
  border: 1px solid var(--oc-role-outline-variant, #ddd);
  border-radius: 4px;
  background: var(--oc-role-surface-container-high, #f5f5f5);
  color: inherit;
  font-size: 0.8rem;
  font-family: monospace;
}

.scheme-switch {
  display: flex;
  gap: 0;
  align-self: center;
}

.scheme-switch button {
  font-family: monospace;
  font-size: 0.8rem;
  padding: 4px 12px;
  border-radius: 0;
}

.scheme-switch button:first-child {
  border-radius: 4px 0 0 4px;
}

.scheme-switch button:last-child {
  border-radius: 0 4px 4px 0;
  border-left: none;
}

.scheme-switch button.active {
  background: var(--oc-role-primary, #0082c9);
  color: var(--oc-role-on-primary, #fff);
  border-color: transparent;
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

button:hover {
  background: var(--oc-role-surface-container-highest, #e0e0e0);
}

button.primary {
  background: var(--oc-role-primary, #0082c9);
  color: var(--oc-role-on-primary, #fff);
  border-color: transparent;
}

button.primary:hover {
  opacity: 0.9;
  background: var(--oc-role-primary, #0082c9);
}

</style>
