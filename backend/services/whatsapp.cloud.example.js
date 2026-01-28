const https = require('https')

function requiredEnv(name) {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const data = Buffer.from(JSON.stringify(body), 'utf8')

    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          ...headers
        }
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          const status = res.statusCode || 0
          if (status >= 200 && status < 300) {
            try {
              return resolve(raw ? JSON.parse(raw) : {})
            } catch {
              return resolve({ ok: true, raw })
            }
          }
          return reject(new Error(`WhatsApp Cloud API error: HTTP ${status} - ${raw}`))
        })
      }
    )

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function apiBase() {
  const version = String(process.env.WHATSAPP_API_VERSION || 'v20.0').trim()
  const phoneNumberId = requiredEnv('WHATSAPP_PHONE_NUMBER_ID')
  return `https://graph.facebook.com/${version}/${phoneNumberId}/messages`
}

function authHeaders() {
  const token = requiredEnv('WHATSAPP_CLOUD_TOKEN')
  return { Authorization: `Bearer ${token}` }
}

// Envio simples de texto (pode falhar se a conta exigir template para conversas fora da janela)
exports.enviarWhatsAppTextMessage = async (toE164, message) => {
  const payload = {
    messaging_product: 'whatsapp',
    to: String(toE164 || '').replace(/^\+/, ''),
    type: 'text',
    text: {
      preview_url: false,
      body: String(message || '')
    }
  }

  return postJson(apiBase(), authHeaders(), payload)
}

// Envio por template (recomendado para lembretes proativos)
// templateName: nome do template aprovado no WhatsApp Manager
// languageCode: ex. 'pt_BR'
// components: opcional; ex. [{ type: 'body', parameters: [{ type:'text', text:'...' }] }]
exports.enviarWhatsAppTemplate = async (toE164, templateName, languageCode = 'pt_BR', components = undefined) => {
  const payload = {
    messaging_product: 'whatsapp',
    to: String(toE164 || '').replace(/^\+/, ''),
    type: 'template',
    template: {
      name: String(templateName || '').trim(),
      language: { code: String(languageCode || 'pt_BR') },
      ...(components ? { components } : {})
    }
  }

  if (!payload.template.name) throw new Error('templateName is required')

  return postJson(apiBase(), authHeaders(), payload)
}
