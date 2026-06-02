import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works at username.github.io/<repo>/ without
// hardcoding the repo name. No client-side router is used (panes, not routes),
// so relative asset paths are all we need.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
