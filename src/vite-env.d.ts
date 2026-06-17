/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Footer brand name (the linked text), e.g. "Membasuh". */
  readonly VITE_BRAND_NAME?: string;
  /** Footer brand link href, e.g. "https://membasuh.com". */
  readonly VITE_BRAND_URL?: string;
  /** Site URL printed in the Save-Image story footer, e.g. "https://ihsg.membasuh.com". */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Library tracks generated at build time from public/audio/ ID3 tags by
    vite-plugin-song-library.ts. Shape matches `Song` in src/audio/useAudioEngine.ts. */
declare module "virtual:song-library" {
  const songs: { id: string; title: string; sub?: string; url: string }[];
  export default songs;
}
