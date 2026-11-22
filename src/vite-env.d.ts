/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Build id (yyyymmddhhmmss) stamped in by vite.config.ts; also in sw.js. */
declare const __APP_BUILD__: string
