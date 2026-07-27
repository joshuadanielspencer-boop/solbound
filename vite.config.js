import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base-path aware from day one, the same way Shutterbug is: served from a domain
// root by default, or under /<repo>/ for a GitHub Pages project site.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
  // Honour PORT when something hands us one (the editor's preview runner does,
  // so two sessions can each run their own dev server without colliding).
  // strictPort so we fail loudly instead of silently drifting to another port
  // than the one the caller is about to open.
  ...(process.env.PORT ? { server: { port: Number(process.env.PORT), strictPort: true } } : {}),
});
