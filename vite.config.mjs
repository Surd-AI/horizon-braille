import { defineConfig } from "vite";
export default defineConfig({
  root: "apps/playground",
  envDir: false,
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: "../../dist/playground", emptyOutDir: true },
});
