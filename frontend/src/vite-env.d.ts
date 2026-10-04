/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API address, for example http://localhost:8000. Set in frontend/.env. */
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
