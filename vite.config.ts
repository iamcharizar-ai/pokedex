import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The sprites (about 100 MB) are not part of the app build: they live in sprites/, are deployed once as
// their own Vercel project (npm run sprites:deploy) and reach the app through the /sprites rewrite in
// vercel.json. Locally, the dev and preview servers serve the folder at the same path.
const SPRITES = path.resolve(import.meta.dirname, 'sprites')
const TYPES: Record<string, string> = { '.png': 'image/png', '.gif': 'image/gif', '.json': 'application/json', '.webp': 'image/webp' }

const serveSprites: Connect.NextHandleFunction = (req, res, next) => {
  const url = req.url?.split('?')[0] ?? ''
  if (!url.startsWith('/sprites/')) return next()
  const file = path.join(SPRITES, decodeURIComponent(url.slice('/sprites/'.length)))
  if (!file.startsWith(SPRITES + path.sep)) { res.statusCode = 404; res.end(); return }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.statusCode = 404; res.end(); return }
    res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream')
    res.setHeader('Access-Control-Allow-Origin', '*')
    fs.createReadStream(file).pipe(res)
  })
}

const sprites = (): Plugin => ({
  name: 'local-sprites',
  configureServer: (s) => { s.middlewares.use(serveSprites) },
  configurePreviewServer: (s) => { s.middlewares.use(serveSprites) },
})

export default defineConfig({
  plugins: [react(), sprites()],
  server: { port: 5190 },
})
