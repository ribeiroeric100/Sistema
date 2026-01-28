// Exemplo de Integração com SMS (Twilio)
// Install: npm install twilio

const twilio = require('twilio')

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhone = process.env.TWILIO_PHONE_NUMBER

const client = twilio(accountSid, authToken)

// Enviar lembrete de consulta via SMS
exports.enviarLembreteSMS = async (telefone, paciente, consulta) => {
  const dataConsulta = new Date(consulta.data_hora)
  const hora = dataConsulta.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const data = dataConsulta.toLocaleDateString('pt-BR')

  const mensagem = `Olá ${paciente.nome}! Lembrete de sua consulta no dia ${data} às ${hora}. Clínica Odontológica.`

  try {
    await client.messages.create({
      body: mensagem,
      from: twilioPhone,
      to: telefone
    })
    console.log(`SMS enviado para ${telefone}`)
  } catch (err) {
    console.error('Erro ao enviar SMS:', err)
  }
}

// Enviar mensagem via WhatsApp usando Twilio (se configurado)
exports.enviarWhatsAppMessage = async (telefone, mensagem) => {
  // Twilio WhatsApp format: 'whatsapp:+15551234567'
  const fromWhats = process.env.TWILIO_WHATSAPP_NUMBER || twilioPhone
  if (!fromWhats) {
    console.log('(sms.example) Twilio não configurado; WhatsApp fallback:')
    console.log(`To: ${telefone} -- Msg: ${mensagem}`)
    return
  }

  try {
    await client.messages.create({
      body: mensagem,
      from: fromWhats.startsWith('whatsapp:') ? fromWhats : `whatsapp:${fromWhats}`,
      to: telefone.startsWith('whatsapp:') ? telefone : `whatsapp:${telefone}`
    })
    console.log(`WhatsApp enviado para ${telefone}`)
  } catch (err) {
    console.error('Erro ao enviar WhatsApp via Twilio:', err)
  }
}

// Enviar confirmação de pagamento via SMS
exports.enviarConfirmacaoPagamentoSMS = async (telefone, paciente, valor) => {
  const mensagem = `${paciente.nome}, pagamento de R$ ${valor.toFixed(2)} confirmado! Sua consulta está agendada. Clínica Odontológica.`

  try {
    await client.messages.create({
      body: mensagem,
      from: twilioPhone,
      to: telefone
    })
  } catch (err) {
    console.error('Erro ao enviar SMS:', err)
  }
}

// Enviar código de verificação
exports.enviarCodigoVerificacaoSMS = async (telefone, codigo) => {
  const mensagem = `Seu código de verificação é: ${codigo}`

  try {
    await client.messages.create({
      body: mensagem,
      from: twilioPhone,
      to: telefone
    })
  } catch (err) {
    console.error('Erro ao enviar SMS:', err)
  }
}
