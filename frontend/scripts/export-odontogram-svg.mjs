import fs from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_URL = 'https://raw.githubusercontent.com/biomathcode/react-odontogram/main/src/data.ts'
const DATA_FILE = path.join(__dirname, 'react-odontogram-data.mjs')
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'odontogram-fdi.svg')

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} while downloading ${url}`))
          res.resume()
          return
        }
        res.setEncoding('utf8')
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve(data))
      })
      .on('error', reject)
  })
}

function normalizeDataModule(tsText) {
  // The upstream file is valid ESM (no TS types). We keep it as-is,
  // just add a header comment and ensure it exports teethPaths.
  const trimmed = String(tsText || '').trim()
  if (!trimmed.includes('export const teethPaths')) {
    throw new Error('Unexpected format: teethPaths export not found in downloaded file')
  }
  return `// Auto-fetched from biomathcode/react-odontogram\n// Source: ${DATA_URL}\n\n${trimmed}\n`
}

function escapeAttr(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [v]
}

function buildSvg({ teethPaths }) {
  const quadrants = [
    { transform: '', prefix: 'teeth-1', label: 'Upper Right' },
    { transform: 'scale(-1, 1) translate(-409, 0)', prefix: 'teeth-2', label: 'Upper Left' },
    { transform: 'scale(1, -1) translate(0, -694)', prefix: 'teeth-4', label: 'Lower Right' },
    { transform: 'scale(-1, -1) translate(-409, -694)', prefix: 'teeth-3', label: 'Lower Left' }
  ]

  const style = `
svg { color: #cbd5e1; }
.tooth .outline { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.tooth .shadow { fill: currentColor; opacity: 0; transition: opacity 120ms ease; }
.tooth .highlight { fill: none; stroke: currentColor; opacity: 0.0; }
.tooth:hover .shadow { opacity: 0.12; }
.tooth[data-selected="1"] { color: #22c55e; }
.tooth[data-selected="1"] .shadow { opacity: 0.18; }
`;

  const parts = []
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`)
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 409 694" fill="none" role="img" aria-label="Odontograma">`
  )
  parts.push(`<style>${style}</style>`)
  parts.push(`<title>Odontograma (FDI)</title>`)

  quadrants.forEach((q) => {
    parts.push(`<g data-quadrant="${escapeAttr(q.label)}" transform="${escapeAttr(q.transform)}">`)

    for (const tooth of teethPaths) {
      const id = `${q.prefix}${tooth.name}` // e.g. teeth-11
      const fdi = id.replace('teeth-', '')

      parts.push(
        `<g id="${escapeAttr(id)}" class="tooth ${escapeAttr(id)}" data-fdi="${escapeAttr(fdi)}" data-selected="0">`
      )
      parts.push(`<title>${escapeAttr(fdi)}</title>`)
      parts.push(`<path class="outline" d="${escapeAttr(tooth.outlinePath)}" />`)
      parts.push(`<path class="shadow" d="${escapeAttr(tooth.shadowPath)}" />`)

      const highlights = ensureArray(tooth.lineHighlightPath)
      for (const d of highlights) {
        if (!d) continue
        parts.push(`<path class="highlight" d="${escapeAttr(d)}" />`)
      }

      parts.push(`</g>`)
    }

    parts.push(`</g>`)
  })

  parts.push(`</svg>`)
  return parts.join('\n')
}

async function main() {
  // 1) Ensure we have the upstream data locally.
  if (!(await exists(DATA_FILE))) {
    console.log(`Downloading tooth paths from ${DATA_URL} ...`)
    const tsText = await download(DATA_URL)
    const moduleText = normalizeDataModule(tsText)
    await fs.writeFile(DATA_FILE, moduleText, 'utf8')
    console.log(`Saved: ${DATA_FILE}`)
  }

  // 2) Import teethPaths.
  const mod = await import(pathToFileURL(DATA_FILE))
  const teethPaths = mod.teethPaths
  if (!Array.isArray(teethPaths) || teethPaths.length === 0) {
    throw new Error('Invalid teethPaths: expected a non-empty array')
  }

  // 3) Build svg.
  const svg = buildSvg({ teethPaths })

  // 4) Write output.
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
  await fs.writeFile(OUTPUT_FILE, svg, 'utf8')

  console.log(`Generated: ${OUTPUT_FILE}`)
  console.log(`Tip: open /odontogram-fdi.svg in the browser or import into Figma.`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
