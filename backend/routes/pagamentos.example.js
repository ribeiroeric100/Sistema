// Exemplo de integração com Stripe
// Install: npm install stripe

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { db } = require('../config/database')
const { v4: uuidv4 } = require('uuid')

// Criar intenção de pagamento
exports.criarIntencaoPagamento = async (req, res) => {
  const { valor, consulta_id, descricao } = req.body

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(valor * 100), // Stripe usa centavos
      currency: 'brl',
      metadata: {
        consulta_id,
        usuario_id: req.user.id
      },
      description: descricao || `Consulta ${consulta_id}`
    })

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Confirmar pagamento e atualizar consulta
exports.confirmarPagamento = async (req, res) => {
  const { paymentIntentId, consulta_id } = req.body

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status === 'succeeded') {
      // Atualizar status da consulta como paga
      db.run(
        'UPDATE consultas SET pago = 1 WHERE id = ?',
        [consulta_id],
        function(err) {
          if (err) return res.status(500).json({ error: err.message })
          res.json({ success: true, status: 'paid' })
        }
      )
    } else {
      res.status(400).json({ error: 'Pagamento não confirmado' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Webhook para notificações do Stripe
exports.handleStripeWebhook = async (req, res) => {
  const event = req.body

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object
        const { consulta_id } = paymentIntent.metadata
        
        db.run(
          'UPDATE consultas SET pago = 1 WHERE id = ?',
          [consulta_id]
        )
        console.log(`Pagamento bem-sucedido para consulta: ${consulta_id}`)
        break

      case 'payment_intent.payment_failed':
        console.log('Pagamento falhou')
        break
    }

    res.json({ received: true })
  } catch (err) {
    res.status(400).json({ error: 'Webhook error' })
  }
}
