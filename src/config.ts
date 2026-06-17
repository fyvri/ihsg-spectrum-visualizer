/* =============================================================================
   Build-time brand config, sourced from Vite env vars (VITE_*). These are
   PUBLIC strings baked into the client bundle — set them in .env / .env.local
   or the deploy environment. See .env.example.
   ============================================================================= */

/** Footer brand name (the linked text). */
export const BRAND_NAME = import.meta.env.VITE_BRAND_NAME || "Membasuh";

/** Footer brand link href. */
export const BRAND_URL = import.meta.env.VITE_BRAND_URL || "https://membasuh.com";

/** Site URL printed at the bottom of the Save-Image story export. */
export const SITE_URL = import.meta.env.VITE_SITE_URL || "https://ihsg.membasuh.com";
