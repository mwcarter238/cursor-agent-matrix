/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEV_API_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// MediaTrackCapabilities/constraints don't yet include the torch flag in the
// standard lib types, so widen them here for the flashlight control.
interface MediaTrackCapabilities {
  torch?: boolean;
}
interface MediaTrackConstraintSet {
  torch?: boolean;
}
