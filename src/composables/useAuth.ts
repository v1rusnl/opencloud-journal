import { computed } from 'vue'
import { useAuthStore, useUserStore, useConfigStore } from '@opencloud-eu/web-pkg'
import { TOKEN_LABEL, TOKEN_STORAGE_PREFIX } from '@/constants'

// Token is stored in localStorage keyed by user UUID so it persists across
// tabs and page reloads and is not recreated unnecessarily.
const EXPIRY = '24h'
const STORAGE_PREFIX = TOKEN_STORAGE_PREFIX

interface StoredToken {
  token: string
  expiresAt: number // Unix ms
}

function storageKey(userPathId: string): string {
  return `${STORAGE_PREFIX}${userPathId}`
}


function loadStoredToken(userPathId: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey(userPathId))
    if (!raw) return null
    const stored: StoredToken = JSON.parse(raw)
    if (Date.now() >= stored.expiresAt) {
      localStorage.removeItem(storageKey(userPathId))
      return null
    }
    return stored.token
  } catch {
    return null
  }
}

function saveToken(userPathId: string, token: string) {
  const stored: StoredToken = {
    token,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 h
  }
  localStorage.setItem(storageKey(userPathId), JSON.stringify(stored))
}

// In-flight token requests keyed by userPathId — prevents concurrent POSTs
// for the same user while allowing independent requests for different users.
const tokenRequestsInFlight = new Map<string, Promise<string>>()

export function useAuth() {
  const authStore = useAuthStore()
  const userStore = useUserStore()
  const configStore = useConfigStore()

  const user = computed(() => userStore.user)
  // username for Basic auth (human-readable)
  const userId = computed(
    () => user.value?.onPremisesSamAccountName || user.value?.id || '',
  )
  // UUID used by Radicale as the collection path
  const userPathId = computed(() => user.value?.id || userId.value)
  const serverUrl = computed(() => configStore.serverUrl)
  const accessToken = computed(() => authStore.accessToken)

  async function getAppToken(): Promise<string> {
    const id = userPathId.value
    const cached = loadStoredToken(id)
    if (cached) return cached

    const inflight = tokenRequestsInFlight.get(id)
    if (inflight) return inflight

    const promise = (async () => {
      // Only delete expired journal tokens — avoids revoking valid tokens
      // from other tabs or devices running the same app concurrently.
      try {
        const listRes = await fetch('/auth-app/tokens', {
          headers: { Authorization: `Bearer ${accessToken.value}` },
        })
        if (listRes.ok) {
          const tokens: { token: string; label: string; expiration_date: string }[] = await listRes.json()
          const now = new Date()
          await Promise.all(
            tokens
              .filter(t => t.label === TOKEN_LABEL && new Date(t.expiration_date) <= now)
              .map(t => fetch(`/auth-app/tokens?token=${encodeURIComponent(t.token)}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken.value}` },
              }))
          )
        }
      } catch {
        // Cleanup failure is non-fatal — proceed to create a new token.
      }

      const res = await fetch(`/auth-app/tokens?expiry=${EXPIRY}&label=${TOKEN_LABEL}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken.value}` },
      })

      if (!res.ok) throw new Error(`Failed to create app token: ${res.status} ${res.statusText}`)

      const data = await res.json()
      const token: string = data.token
      if (!token) throw new Error('No app token in response')

      saveToken(id, token)
      return token
    })().finally(() => { tokenRequestsInFlight.delete(id) })

    tokenRequestsInFlight.set(id, promise)
    return promise
  }

  function clearAppToken() {
    localStorage.removeItem(storageKey(userPathId.value))
  }

  return { user, userId, userPathId, serverUrl, accessToken, getAppToken, clearAppToken }
}
