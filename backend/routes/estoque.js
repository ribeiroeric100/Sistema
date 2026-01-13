const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { db } = require('../config/database')
const { verifyToken, verifyRole } = require('../middleware/auth')
const { logAudit } = require('../services/audit')
const router = express.Router()

// Listar produtos
router.get('/', verifyToken, (req, res) => {
  db.all('SELECT * FROM produtos_estoque WHERE ativo = 1', (err, products) => {
    if (err) return res.status(500).json({ error: err.message })
    logAudit(req, 'estoque.list')
    res.json(products)
  })
})

// Buscar produto por ID
router.get('/:id', verifyToken, (req, res) => {
  db.get('SELECT * FROM produtos_estoque WHERE id = ?', [req.params.id], (err, product) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' })
    logAudit(req, 'estoque.get', { entityType: 'produto', entityId: req.params.id })
    res.json(product)
  })
})

// Criar produto
router.post('/', verifyToken, verifyRole(['admin']), (req, res) => {
  const { nome, descricao, quantidade, quantidade_minima, unidade, preco_unitario, fornecedor, categoria, data_vencimento } = req.body
  const id = uuidv4()

  db.run(
    `INSERT INTO produtos_estoque (id, nome, descricao, quantidade, quantidade_minima, unidade, preco_unitario, fornecedor, categoria, data_vencimento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, nome, descricao, quantidade || 0, quantidade_minima || 5, unidade || 'un', preco_unitario, fornecedor, categoria, data_vencimento || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      logAudit(req, 'estoque.create', { entityType: 'produto', entityId: id })
      res.json({ id, nome, quantidade, quantidade_minima })
    }
  )
})

// Atualizar produto
router.put('/:id', verifyToken, verifyRole(['admin']), (req, res) => {
  const { nome, descricao, quantidade, quantidade_minima, unidade, preco_unitario, fornecedor, categoria, data_vencimento } = req.body
  db.run(
    `UPDATE produtos_estoque SET nome = ?, descricao = ?, quantidade = ?, quantidade_minima = ?, unidade = ?, preco_unitario = ?, fornecedor = ?, categoria = ?, data_vencimento = ? WHERE id = ?`,
    [nome, descricao, quantidade, quantidade_minima, unidade, preco_unitario, fornecedor, categoria, data_vencimento || null, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      logAudit(req, 'estoque.update', { entityType: 'produto', entityId: req.params.id })
      res.json({ success: true })
    }
  )
})

// Deletar (soft-delete) produto
router.delete('/:id', verifyToken, verifyRole(['admin']), (req, res) => {
  db.run('UPDATE produtos_estoque SET ativo = 0 WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    logAudit(req, 'estoque.delete', { entityType: 'produto', entityId: req.params.id })
    res.json({ success: true })
  })
})

// Atualizar quantidade (entrada ou saída)
router.post('/:id/movimentar', verifyToken, verifyRole(['admin', 'dentista', 'recepcao']), (req, res) => {
  const { quantidade, tipo, motivo } = req.body // tipo: 'entrada' ou 'saída'
  const movimentacao_id = uuidv4()

  db.run('BEGIN TRANSACTION')

  // Registrar movimentação
  db.run(
    'INSERT INTO movimentacoes_estoque (id, produto_id, tipo, quantidade, motivo, usuario_id) VALUES (?, ?, ?, ?, ?, ?)',
    [movimentacao_id, req.params.id, tipo, quantidade, motivo, req.user.id],
    function(err) {
      if (err) {
        db.run('ROLLBACK')
        return res.status(500).json({ error: err.message })
      }

      // Atualizar quantidade do produto
      const valor = tipo === 'entrada' ? quantidade : -quantidade
      db.run(
        'UPDATE produtos_estoque SET quantidade = quantidade + ? WHERE id = ?',
        [valor, req.params.id],
        function(err) {
          if (err) {
            db.run('ROLLBACK')
            return res.status(500).json({ error: err.message })
          }

          // Verificar se precisa alerta
          db.get('SELECT quantidade, quantidade_minima FROM produtos_estoque WHERE id = ?', [req.params.id], (err, product) => {
            if (product && product.quantidade <= product.quantidade_minima) {
              const alerta_id = uuidv4()
              db.run(
                'INSERT INTO alertas_estoque (id, produto_id, tipo, mensagem) VALUES (?, ?, ?, ?)',
                [alerta_id, req.params.id, 'reposicao', `Produto com estoque baixo: ${product.quantidade} un.`]
              )
            }

            db.run('COMMIT')
            logAudit(req, 'estoque.movimentar', { entityType: 'produto', entityId: req.params.id, details: { tipo, quantidade, motivo } })
            res.json({ success: true, movimentacao_id })
          })
        }
      )
    }
  )
})

// Alertas de reposição
router.get('/alertas/reposicao', verifyToken, (req, res) => {
  db.all(
    `SELECT a.*, p.nome, p.quantidade FROM alertas_estoque a
     JOIN produtos_estoque p ON a.produto_id = p.id
     WHERE a.lido = 0 AND a.tipo = 'reposicao'
     ORDER BY a.criado_em DESC`,
    (err, alertas) => {
      if (err) return res.status(500).json({ error: err.message })
      logAudit(req, 'estoque.alertas_list')
      res.json(alertas)
    }
  )
})

module.exports = router
