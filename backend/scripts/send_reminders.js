#!/usr/bin/env node
/*
  Script simples para enviar lembretes de consultas para pacientes.
  - Busca consultas agendadas para amanhã (DATE(data_hora) = tomorrow)
  - Respeita flags em `configuracoes`: `lembrete_whatsapp_ativo`, `lembrete_email_ativo` e `mensagem_lembrete`
  - Usa serviços de exemplo `services/sms.example.js` e `services/email.example.js` quando disponíveis

  Execução manual:
    node backend/scripts/send_reminders.js

  Agendamento: adicione ao cron/Task Scheduler para rodar uma vez por dia (ex.: 08:00).
*/

const path = require('path')
const { db, initialize } = require('../config/database')

let smsSvc = null
let emailSvc = null
let whatsappCloudSvc = null
try { smsSvc = require('../services/sms.example') } catch (e) { /* optional */ }
try { emailSvc = require('../services/email.example') } catch (e) { /* optional */ }
try { whatsappCloudSvc = require('../services/whatsapp.cloud.example') } catch (e) { /* optional */ }

function safe(v) { return v === null || v === undefined ? '' : String(v) }

function formatDateTime(dt) {
  try {
    const d = new Date(dt)
    const data = d.toLocaleDateString('pt-BR')
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return { data, hora }
  } catch (e) {
    return { data: safe(dt), hora: '' }
  }
}

function applyTemplate(tpl, vars) {
  if (!tpl) return ''
  return String(tpl)
    .replace(/{{\s*paciente\s*}}/gi, safe(vars.paciente))
    .replace(/{{\s*dentista\s*}}/gi, safe(vars.dentista))
    .replace(/{{\s*data\s*}}/gi, safe(vars.data))
    .replace(/{{\s*hora\s*}}/gi, safe(vars.hora))
}

function normalizePhoneDigits(v) {
  const digits = String(v || '').replace(/[^0-9]+/g, '')
  return digits
}

function toE164BR(v) {
  const digits = normalizePhoneDigits(v)
  if (!digits) return ''

  // If already includes country code 55.
  if (digits.length >= 12 && digits.startsWith('55')) return `+${digits}`

  // If looks like BR local (10/11 digits DDD+number), prefix +55.
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`

  // Fallback: return as +<digits> so providers can validate.
  return `+${digits}`
}

async function run() {
  try {
    await initialize()
  } catch (e) {
    // ignore if already initialized or no DB
  }

  // Load all configurations
  const rows = await db.all('SELECT chave, valor FROM configuracoes')
  const cfg = {}
  for (const r of rows || []) cfg[r.chave] = r.valor

  const sendWhatsapp = String(cfg.lembrete_whatsapp_ativo || 'true') === 'true'
  const sendEmail = String(cfg.lembrete_email_ativo || 'false') === 'true'
  const mensagemTpl = cfg.mensagem_lembrete || 'Olá {{paciente}}! Lembrete: sua consulta com {{dentista}} é em {{data}} às {{hora}}.'

  // Quantas horas antes devemos enviar o lembrete? (DEFAULT 2)
  let hoursBefore = parseInt(String(process.env.REMINDER_HOURS_BEFORE || cfg.reminder_hours_before || '2'), 10)
  if (!Number.isInteger(hoursBefore) || hoursBefore <= 0) hoursBefore = 2

  // Buscar consultas agendadas entre agora e (agora + hoursBefore)
  const consultas = await db.all(
    `SELECT c.id, c.data_hora, c.tipo_consulta, c.valor, c.paciente_id, p.nome as paciente_nome, p.telefone, p.email, u.nome as dentista_nome
     FROM consultas c
     JOIN pacientes p ON p.id = c.paciente_id
     LEFT JOIN usuarios u ON u.id = c.dentista_id
     WHERE c.data_hora BETWEEN NOW() AND NOW() + INTERVAL '${hoursBefore} hours'
       AND c.status = ?
       AND c.lembrete_whatsapp_enviado_em IS NULL`,
    ['agendada']
  )

  if (!consultas || !consultas.length) {
    console.log(`Nenhuma consulta encontrada nas próximas ${hoursBefore} hora(s).`)
    return
  }

  console.log(`Encontradas ${consultas.length} consulta(s) nas próximas ${hoursBefore} hora(s). Enviando lembretes...`)

  for (const c of consultas) {
    const pacienteNome = c.paciente_nome || ''
    const dentistaNome = c.dentista_nome || ''
    const { data, hora } = formatDateTime(c.data_hora)
    const message = applyTemplate(mensagemTpl, { paciente: pacienteNome, dentista: dentistaNome, data, hora })

    // WhatsApp / SMS
    if (sendWhatsapp && c.telefone) {
      const telefoneE164 = toE164BR(c.telefone)

      let whatsappSent = false

      // Prefer WhatsApp Cloud API (Meta) if configured.
      if (whatsappCloudSvc && typeof whatsappCloudSvc.enviarWhatsAppTextMessage === 'function') {
        try {
          await whatsappCloudSvc.enviarWhatsAppTextMessage(telefoneE164, message)
          console.log(`WhatsApp (Cloud API) enviado para ${telefoneE164} (consulta ${c.id})`)
          whatsappSent = true
        } catch (e) {
          console.error(`Erro ao enviar WhatsApp (Cloud API) para ${telefoneE164} (consulta ${c.id}):`, e && e.message ? e.message : e)
        }
      } else if (smsSvc && typeof smsSvc.enviarWhatsAppMessage === 'function') {
        try {
          await smsSvc.enviarWhatsAppMessage(telefoneE164, message)
          console.log(`WhatsApp (Twilio) enviado para ${telefoneE164} (consulta ${c.id})`)
          whatsappSent = true
        } catch (e) {
          console.error(`Erro ao enviar WhatsApp (Twilio) para ${telefoneE164} (consulta ${c.id}):`, e && e.message ? e.message : e)
        }
      } else if (smsSvc && typeof smsSvc.enviarLembreteSMS === 'function') {
        // fallback para SMS se não houver método WhatsApp explícito
        try {
          await smsSvc.enviarLembreteSMS(telefoneE164, { nome: pacienteNome, email: c.email }, { data_hora: c.data_hora })
          console.log(`SMS (fallback) enviado para ${telefoneE164} (consulta ${c.id})`)
        } catch (e) {
          console.error(`Erro ao enviar SMS para ${telefoneE164} (consulta ${c.id}):`, e && e.message ? e.message : e)
        }
      } else {
        // Fallback: log a URL de WhatsApp com mensagem (útil para testes)
        const wa = `https://wa.me/${encodeURIComponent(normalizePhoneDigits(telefoneE164))}?text=${encodeURIComponent(message)}`
        console.log(`(fallback) WhatsApp link for ${telefoneE164}: ${wa}`)
      }

      if (whatsappSent) {
        try {
          await db.run(
            'UPDATE consultas SET lembrete_whatsapp_enviado_em = CURRENT_TIMESTAMP WHERE id = ?',
            [c.id]
          )
        } catch (e) {
          console.error(`Erro ao marcar lembrete_whatsapp_enviado_em (consulta ${c.id}):`, e && e.message ? e.message : e)
        }
      }
    }

    // Email
    if (sendEmail && c.email) {
      if (emailSvc && typeof emailSvc.enviarLembreteConsulta === 'function') {
        try {
          await emailSvc.enviarLembreteConsulta({ nome: pacienteNome, email: c.email }, { data_hora: c.data_hora, tipo_consulta: c.tipo_consulta, valor: c.valor })
          console.log(`Email enviado para ${c.email} (consulta ${c.id})`)
        } catch (e) {
          console.error(`Erro ao enviar email para ${c.email} (consulta ${c.id}):`, e && e.message ? e.message : e)
        }
      } else {
        console.log(`(fallback) Simular envio de email para ${c.email}: ${message}`)
      }
    }
  }

  console.log('Processo de envio de lembretes finalizado.')
}

run().catch((e) => {
  console.error('Erro no script de lembretes:', e && e.stack ? e.stack : e)
  process.exit(1)
})
