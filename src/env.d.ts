/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '@opencloud-eu/extension-sdk' {
  export const defineConfig: (overrides?: Record<string, unknown>) => unknown
}
