/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BAIDU_AK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
