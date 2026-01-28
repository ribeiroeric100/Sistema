#!/usr/bin/env node
/*
  Teste local para o fluxo de lembretes.
  - Simula uma consulta marcada para daqui a 2 horas
  - Usa `backend/services/sms.example.js` e `backend/services/email.example.js` quando disponíveis
  - Não toca no banco de dados nem exige credenciais reais (usa fallbacks do service)

  Execução:
    node backend/scripts/send_reminders_local_test.js
*/

const path = require('path')
let smsSvc = null
let emailSvc = null
try { smsSvc = require('../services/sms.example') } catch (e) { /* optional */ }
try { emailSvc = require('../services/email.example') } catch (e) { /* optional */ }

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

async function main() {
  const now = Date.now()
  const twoHours = 2 * 60 * 60 * 1000
  const consultaTime = new Date(now + twoHours).toISOString()

  const c = {
    id: 9999,
    data_hora: consultaTime,
    tipo_consulta: 'Rotina',
    valor: 120.0,
    paciente_id: 1,
    paciente_nome: 'Fulano da Silva',
    telefone: '+55 11 99999-9999',
    email: 'fulano@example.com',
    dentista_nome: 'Dr. João'
  }

  const { data, hora } = formatDateTime(c.data_hora)
  const mensagemTpl = 'Olá {{paciente}}, sua consulta com o Dr. {{dentista}} é em {{data}} às {{hora}}.'
  const message = applyTemplate(mensagemTpl, { paciente: c.paciente_nome, dentista: c.dentista_nome, data, hora })

  console.log('Simulando envio de lembrete para:')
  console.log(`- Paciente: ${c.paciente_nome}`)
  console.log(`- Telefone: ${c.telefone}`)
  console.log(`- Email: ${c.email}`)
  console.log(`- Data/Hora: ${c.data_hora}`)
  console.log(`- Mensagem: ${message}`)

  // Test WhatsApp/SMS flow
  if (c.telefone) {
    if (smsSvc && typeof smsSvc.enviarWhatsAppMessage === 'function') {
      console.log('Chamando smsSvc.enviarWhatsAppMessage...')
      try {
        await smsSvc.enviarWhatsAppMessage(c.telefone, message)
      } catch (e) {
        console.error('Erro no enviarWhatsAppMessage:', e && e.message ? e.message : e)
      }
    } else if (smsSvc && typeof smsSvc.enviarLembreteSMS === 'function') {
      console.log('Chamando smsSvc.enviarLembreteSMS (fallback)...')
      try {
        await smsSvc.enviarLembreteSMS(c.telefone, { nome: c.paciente_nome, email: c.email }, { data_hora: c.data_hora })
      } catch (e) {
        console.error('Erro no enviarLembreteSMS:', e && e.message ? e.message : e)
      }
    } else {
      const wa = `https://wa.me/${encodeURIComponent(c.telefone.replace(/[^0-9]+/g,''))}?text=${encodeURIComponent(message)}`
      console.log('(fallback) WhatsApp link:', wa)
    }
  }

  // Test Email fallback
  if (c.email) {
    if (emailSvc && typeof emailSvc.enviarLembreteConsulta === 'function') {
      console.log('Chamando emailSvc.enviarLembreteConsulta...')
      try {
        await emailSvc.enviarLembreteConsulta({ nome: c.paciente_nome, email: c.email }, { data_hora: c.data_hora, tipo_consulta: c.tipo_consulta, valor: c.valor })
      } catch (e) {
        console.error('Erro no enviarLembreteConsulta:', e && e.message ? e.message : e)
      }
    } else {
      console.log('(fallback) Simular envio de email para', c.email)
    }
  }

  console.log('Teste local finalizado.')
}

main().catch((e) => {
  console.error('Erro no teste local:', e && e.stack ? e.stack : e)
  process.exit(1)
})
