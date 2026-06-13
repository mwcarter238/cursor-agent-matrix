import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The camera (getUserMedia) requires a secure context. `localhost` counts as
// secure, so `npm run dev` works directly on the dev machine. To test on a
// real phone over the LAN, serve over HTTPS (e.g. a tunnel or a TLS proxy).
const apiProxyTarget = process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react()],
  // For project GitHub Pages the app is served from a subpath
  // (e.g. /cursor-agent-matrix/); the deploy workflow sets VITE_BASE.
  base: process.env.VITE_BASE ?? "/",
  server: {
    host: true,
    port: 5173,
    // Allow tunnel/preview hostnames (e.g. *.trycloudflare.com) so the dev
    // server can be reached over HTTPS for camera testing on a phone.
    allowedHosts: true,
    proxy: {
      "/api": { target: apiProxyTarget, changeOrigin: true },
    },
  },
});
