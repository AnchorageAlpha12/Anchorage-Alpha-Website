import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  // Relative base so the Pages build resolves assets under any repo path
  // (e.g. /anchorage-alpha/ and /Anchorage-Alpha-Website/). Safe because
  // there is no client-side router. Keep '/' in dev for a clean root base.
  base: process.env.GH_PAGES ? './' : '/',
  plugins: [react()]
})
