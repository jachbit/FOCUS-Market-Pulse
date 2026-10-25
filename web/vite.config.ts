import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site at /FOCUS-Market-Pulse/; relative paths keep it working there and locally
export default defineConfig({
  plugins: [react()],
  base: './',
})
