import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const TEXTURE_EXTS = ['.png', '.jpg', '.jpeg', '.webp']

function modelsPlugin() {
  const virtualId = 'virtual:models'
  const resolvedId = '\0' + virtualId

  function scan() {
    const dir = path.resolve('public/models')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.obj'))
      .map(f => {
        const name = f.replace(/\.obj$/i, '').trim()
        const ext = TEXTURE_EXTS.find(e =>
          fs.existsSync(path.join(dir, name + e))
        )
        return {
          name,
          objUrl: `/models/${encodeURIComponent(f)}`,
          texture: ext ? `/models/${encodeURIComponent(name + ext)}` : null,
        }
      })
  }

  return {
    name: 'models-plugin',
    resolveId(id) { if (id === virtualId) return resolvedId },
    load(id) {
      if (id !== resolvedId) return
      return `export const models = ${JSON.stringify(scan())}`
    },
  }
}

export default defineConfig({
  plugins: [react(), modelsPlugin()],
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
})
