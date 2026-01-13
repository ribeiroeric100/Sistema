// Exemplo de Integração com Email (Nodemailer)
// Install: npm install nodemailer

const nodemailer = require('nodemailer')

// Configurar transportador
const transporter = nodemailer.createTransport({
  service: 'gmail', // Ou seu provedor de email
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
})

// Enviar lembrete de consulta
exports.enviarLembreteConsulta = async (paciente, consulta) => {
  const dataConsulta = new Date(consulta.data_hora)
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: paciente.email,
    subject: 'Lembrete de Consulta - Clínica Odontológica',
    html: `
      <h2>Olá ${paciente.nome}!</h2>
      <p>Você tem uma consulta agendada conosco:</p>
      <ul>
        <li><strong>Data:</strong> ${dataConsulta.toLocaleDateString('pt-BR')}</li>
        <li><strong>Hora:</strong> ${dataConsulta.toLocaleTimeString('pt-BR')}</li>
        <li><strong>Tipo:</strong> ${consulta.tipo_consulta}</li>
        <li><strong>Valor:</strong> R$ ${(consulta.valor || 0).toFixed(2)}</li>
      </ul>
      <p>Se precisar remarcar, entre em contato conosco.</p>
      <br>
      <p>Atenciosamente,<br>Clínica Odontológica</p>
    `
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log(`Lembrete enviado para ${paciente.email}`)
  } catch (err) {
    console.error('Erro ao enviar email:', err)
  }
}

// Enviar confirmação de pagamento
exports.enviarConfirmacaoPagamento = async (paciente, consulta, transacao) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: paciente.email,
    subject: 'Pagamento Confirmado - Clínica Odontológica',
    html: `
      <h2>Pagamento Confirmado!</h2>
      <p>Obrigado ${paciente.nome}!</p>
      <p>Seu pagamento foi processado com sucesso.</p>
      <ul>
        <li><strong>Valor:</strong> R$ ${(consulta.valor || 0).toFixed(2)}</li>
        <li><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</li>
        <li><strong>Transação ID:</strong> ${transacao.id}</li>
      </ul>
      <p>Sua consulta está confirmada para ${new Date(consulta.data_hora).toLocaleDateString('pt-BR')}.</p>
      <br>
      <p>Atenciosamente,<br>Clínica Odontológica</p>
    `
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (err) {
    console.error('Erro ao enviar email:', err)
  }
}

// Enviar novo relatório mensal
exports.enviarRelatorioDentista = async (email, relatorio) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Relatório Mensal - ${new Date().toLocaleDateString('pt-BR')}`,
    html: `
      <h2>Relatório do Mês</h2>
      <p>Segue em anexo seu relatório mensal com dados de estoque, receita e agendamentos.</p>
      <ul>
        <li><strong>Receita Total:</strong> R$ ${relatorio.receita?.toLocaleString('pt-BR')}</li>
        <li><strong>Consultas Realizadas:</strong> ${relatorio.consultas}</li>
        <li><strong>Produtos em Alerta:</strong> ${relatorio.alertas}</li>
      </ul>
      <p>Para mais detalhes, acesse o sistema.</p>
    `
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (err) {
    console.error('Erro ao enviar email:', err)
  }
}
