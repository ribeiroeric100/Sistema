const { app, BrowserWindow } = require('electron')
const path = require('path')
const http = require('http')

const DEV_PORTS = [5173, 5174, 5175, 5176]

function probeUrl(url, timeoutMs = 600) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, (res) => {
        // qualquer resposta HTTP indica que o servidor está no ar
        res.resume()
        resolve(true)
      })
      req.on('error', () => resolve(false))
      req.setTimeout(timeoutMs, () => {
        try { req.destroy() } catch (e) {}
        resolve(false)
      })
    } catch (e) {
      resolve(false)
    }
  })
}

async function resolveDevServerUrl() {
  const envUrl = process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL
  if (envUrl) return envUrl

  for (const port of DEV_PORTS) {
    const url = `http://localhost:${port}`
    // eslint-disable-next-line no-await-in-loop
    const ok = await probeUrl(url)
    if (ok) return url
  }

  return 'http://localhost:5173'
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (app.isPackaged) {
    // produção: carregar build do Vite
    const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html')
    win.loadFile(indexPath)
    return
  }

  resolveDevServerUrl().then((url) => {
    win.loadURL(url)
  })
}

app.whenReady().then(createWindow)
