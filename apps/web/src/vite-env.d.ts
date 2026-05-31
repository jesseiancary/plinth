/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Ensure window and document are properly typed
declare const window: Window & typeof globalThis
declare const document: Document
