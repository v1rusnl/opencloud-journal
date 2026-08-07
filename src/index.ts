import { computed } from 'vue'
import { defineWebApplication } from '@opencloud-eu/web-pkg'
import type { AppMenuItemExtension, Extension } from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import { APP_ID } from '@/constants'

function getAppName(): string {
  const lang = document.documentElement.lang || navigator.language || ''
  return lang.toLowerCase().startsWith('de') ? 'Journal' : 'Journal'
}

export default defineWebApplication({
  setup() {
    const appInfo = { id: APP_ID, name: getAppName(), icon: 'book-open' }
    const routes = [
      { path: '/', redirect: `/${appInfo.id}/entries` },
      { name: `${APP_ID}-entries`, path: '/entries', component: () => import('./views/JournalView.vue'), meta: { authContext: 'user', title: appInfo.name } },
    ]
    const extensions = computed<Extension[]>(() => {
      const menuItems: AppMenuItemExtension[] = [{ id: `app.${appInfo.id}.menuItem`, type: 'appMenuItem', label: () => getAppName(), icon: appInfo.icon, path: urlJoin(appInfo.id) }]
      return [...menuItems]
    })
    return { appInfo, routes, extensions }
  },
})
