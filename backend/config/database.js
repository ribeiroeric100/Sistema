const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const dbPath = path.join(__dirname, '../database.db')
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao conectar ao banco:', err)
  else console.log('✅ Conectado ao SQLite')
})

const initialize = () => {
  db.serialize(() => {
    // Tabela de Usuários
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'recepcao',
      ativo BOOLEAN DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)

    // Auditoria (logs de ações relevantes)
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      ip TEXT,
      user_agent TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES usuarios(id)
    )`)
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)')
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)')
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)')

    // Recuperação de senha (tokens temporários com expiração)
    db.run(`CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES usuarios(id)
    )`)
    db.run('CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id)')
    db.run('CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash)')

    // Tabela de Pacientes
    db.run(`CREATE TABLE IF NOT EXISTS pacientes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE,
      telefone TEXT,
      cpf TEXT UNIQUE,
      data_nascimento DATE,
      endereco TEXT,
      numero TEXT,
      complemento TEXT,
      bairro TEXT,
      cidade TEXT,
      cep TEXT,
      observacoes TEXT,
      ativo BOOLEAN DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)

    // Tabela de Consultas
    db.run(`CREATE TABLE IF NOT EXISTS consultas (
      id TEXT PRIMARY KEY,
      paciente_id TEXT NOT NULL,
      dentista_id TEXT,
      data_hora DATETIME NOT NULL,
      tipo_consulta TEXT NOT NULL,
      status TEXT DEFAULT 'agendada',
      descricao TEXT,
      valor DECIMAL(10,2),
      pago BOOLEAN DEFAULT 0,
      procedimentos TEXT,
      materiais TEXT,
      nao_finalizada_tipo TEXT,
      nao_finalizada_motivo TEXT,
      nao_finalizada_observacao TEXT,
      nao_finalizada_em DATETIME,
      nao_finalizada_por TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(paciente_id) REFERENCES pacientes(id),
      FOREIGN KEY(dentista_id) REFERENCES usuarios(id)
    )`)

    // Tabela de Produtos/Estoque
    db.run(`CREATE TABLE IF NOT EXISTS produtos_estoque (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      quantidade INT NOT NULL DEFAULT 0,
      quantidade_minima INT NOT NULL DEFAULT 5,
      unidade TEXT DEFAULT 'un',
      preco_unitario DECIMAL(10,2),
      fornecedor TEXT,
      categoria TEXT,
      data_vencimento DATE,
      ativo BOOLEAN DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)

    // Tabela de Movimentações de Estoque
    db.run(`CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
      id TEXT PRIMARY KEY,
      produto_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      quantidade INT NOT NULL,
      motivo TEXT,
      usuario_id TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(produto_id) REFERENCES produtos_estoque(id),
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`)

    // Tabela de Relatórios
    db.run(`CREATE TABLE IF NOT EXISTS relatorios (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      conteudo TEXT,
      data_inicio DATE,
      data_fim DATE,
      gerado_por TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(gerado_por) REFERENCES usuarios(id)
    )`)

    // Tabela de Alertas de Estoque
    db.run(`CREATE TABLE IF NOT EXISTS alertas_estoque (
      id TEXT PRIMARY KEY,
      produto_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      mensagem TEXT,
      lido BOOLEAN DEFAULT 0,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(produto_id) REFERENCES produtos_estoque(id)
    )`)

    // Tabela para armazenar receita diária persistida
    db.run(`CREATE TABLE IF NOT EXISTS daily_receitas (
      dia DATE PRIMARY KEY,
      total DECIMAL(10,2) DEFAULT 0
    )`)

    // Tabela para armazenar o estado do odontograma por paciente
    db.run(`CREATE TABLE IF NOT EXISTS odontogramas (
      paciente_id TEXT PRIMARY KEY,
      estado_json TEXT NOT NULL,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(paciente_id) REFERENCES pacientes(id)
    )`)

    // Tabela de Configurações (chave/valor) do sistema/clínica
    db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)

    // Defaults de configurações básicas da clínica
    db.run(
      `INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES
        ('nome_clinica', 'DR. NETO ABREU'),
        ('telefone_clinica', ''),
        ('email_clinica', ''),
        ('endereco_clinica', ''),
        ('rodape_pdf', '')`
    )

    // Migração leve: se a instalação já existe e ainda usa o nome padrão antigo, atualiza.
    // Não sobrescreve nomes personalizados.
    db.run(
      `UPDATE configuracoes
       SET valor = 'DR. NETO ABREU', atualizado_em = CURRENT_TIMESTAMP
       WHERE chave = 'nome_clinica'
         AND (
           valor IS NULL
           OR TRIM(valor) = ''
           OR valor IN ('Clínica Odontológica', 'Clinica Odontologica')
         )`
    )

    // Migração leve de roles antigos
    db.run("UPDATE usuarios SET role = 'recepcao' WHERE role IN ('assistente', 'Assistente')")

    console.log('✅ Tabelas criadas/verificadas com sucesso')
    // Garantir colunas adicionais caso base já exista em versões antigas
    db.get("PRAGMA table_info(consultas)", (err) => {
      if (err) return
      db.all("PRAGMA table_info(consultas)", (e, cols) => {
        if (e) return
        const names = (cols || []).map(c => c.name)
        if (!names.includes('procedimentos')) {
          db.run('ALTER TABLE consultas ADD COLUMN procedimentos TEXT')
        }
        if (!names.includes('materiais')) {
          db.run('ALTER TABLE consultas ADD COLUMN materiais TEXT')
        }
        if (!names.includes('nao_finalizada_tipo')) {
          db.run('ALTER TABLE consultas ADD COLUMN nao_finalizada_tipo TEXT')
        }
        if (!names.includes('nao_finalizada_motivo')) {
          db.run('ALTER TABLE consultas ADD COLUMN nao_finalizada_motivo TEXT')
        }
        if (!names.includes('nao_finalizada_observacao')) {
          db.run('ALTER TABLE consultas ADD COLUMN nao_finalizada_observacao TEXT')
        }
        if (!names.includes('nao_finalizada_em')) {
          db.run('ALTER TABLE consultas ADD COLUMN nao_finalizada_em DATETIME')
        }
        if (!names.includes('nao_finalizada_por')) {
          db.run('ALTER TABLE consultas ADD COLUMN nao_finalizada_por TEXT')
        }
      })
    })
  })
}

module.exports = {
  db,
  initialize
}
