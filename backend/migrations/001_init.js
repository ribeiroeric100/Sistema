/* eslint-disable */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('usuarios', {
    id: { type: 'text', primaryKey: true },
    nome: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true, unique: true },
    senha: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true, default: 'recepcao' },
    ativo: { type: 'boolean', default: true },
    criado_em: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })

  pgm.createTable('audit_logs', {
    id: { type: 'text', primaryKey: true },
    user_id: { type: 'text', references: 'usuarios(id)', onDelete: 'set null' },
    user_role: { type: 'text' },
    action: { type: 'text', notNull: true },
    entity_type: { type: 'text' },
    entity_id: { type: 'text' },
    ip: { type: 'text' },
    user_agent: { type: 'text' },
    details: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })
  pgm.createIndex('audit_logs', 'created_at', { name: 'idx_audit_logs_created_at' })
  pgm.createIndex('audit_logs', 'user_id', { name: 'idx_audit_logs_user_id' })
  pgm.createIndex('audit_logs', 'action', { name: 'idx_audit_logs_action' })

  pgm.createTable('password_resets', {
    id: { type: 'text', primaryKey: true },
    user_id: { type: 'text', notNull: true, references: 'usuarios(id)', onDelete: 'cascade' },
    token_hash: { type: 'text', notNull: true },
    expires_at: { type: 'timestamp', notNull: true },
    used_at: { type: 'timestamp' },
    created_ip: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })
  pgm.createIndex('password_resets', 'user_id', { name: 'idx_password_resets_user_id' })
  pgm.createIndex('password_resets', 'token_hash', { name: 'idx_password_resets_token_hash' })

  pgm.createTable('pacientes', {
    id: { type: 'text', primaryKey: true },
    nome: { type: 'text', notNull: true },
    email: { type: 'text', unique: true },
    telefone: { type: 'text' },
    cpf: { type: 'text', unique: true },
    data_nascimento: { type: 'date' },
    endereco: { type: 'text' },
    numero: { type: 'text' },
    complemento: { type: 'text' },
    bairro: { type: 'text' },
    cidade: { type: 'text' },
    cep: { type: 'text' },
    observacoes: { type: 'text' },
    ativo: { type: 'boolean', default: true },
    criado_em: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })

  pgm.createTable('consultas', {
    id: { type: 'text', primaryKey: true },
    paciente_id: { type: 'text', notNull: true, references: 'pacientes(id)', onDelete: 'restrict' },
    dentista_id: { type: 'text', references: 'usuarios(id)', onDelete: 'set null' },
    data_hora: { type: 'timestamp', notNull: true },
    tipo_consulta: { type: 'text', notNull: true },
    status: { type: 'text', default: 'agendada' },
    descricao: { type: 'text' },
    valor: { type: 'numeric(10,2)' },
    pago: { type: 'boolean', default: false },
    procedimentos: { type: 'text' },
    materiais: { type: 'text' },
    nao_finalizada_tipo: { type: 'text' },
    nao_finalizada_motivo: { type: 'text' },
    nao_finalizada_observacao: { type: 'text' },
    nao_finalizada_em: { type: 'timestamp' },
    nao_finalizada_por: { type: 'text' },
    criado_em: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })
  pgm.createIndex('consultas', 'paciente_id')
  pgm.createIndex('consultas', 'dentista_id')
  pgm.createIndex('consultas', 'data_hora')

  pgm.createTable('produtos_estoque', {
    id: { type: 'text', primaryKey: true },
    nome: { type: 'text', notNull: true },
    descricao: { type: 'text' },
    quantidade: { type: 'integer', notNull: true, default: 0 },
    quantidade_minima: { type: 'integer', notNull: true, default: 5 },
    unidade: { type: 'text', default: 'un' },
    preco_unitario: { type: 'numeric(10,2)' },
    fornecedor: { type: 'text' },
    categoria: { type: 'text' },
    data_vencimento: { type: 'date' },
    ativo: { type: 'boolean', default: true },
    criado_em: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })

  pgm.createTable('movimentacoes_estoque', {
    id: { type: 'text', primaryKey: true },
    produto_id: { type: 'text', notNull: true, references: 'produtos_estoque(id)', onDelete: 'restrict' },
    tipo: { type: 'text', notNull: true },
    quantidade: { type: 'integer', notNull: true },
    motivo: { type: 'text' },
    usuario_id: { type: 'text', references: 'usuarios(id)', onDelete: 'set null' },
    criado_em: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })
  pgm.createIndex('movimentacoes_estoque', 'produto_id')

  pgm.createTable('relatorios', {
    id: { type: 'text', primaryKey: true },
    titulo: { type: 'text', notNull: true },
    tipo: { type: 'text', notNull: true },
    conteudo: { type: 'text' },
    data_inicio: { type: 'date' },
    data_fim: { type: 'date' },
    gerado_por: { type: 'text', references: 'usuarios(id)', onDelete: 'set null' },
    criado_em: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })

  pgm.createTable('alertas_estoque', {
    id: { type: 'text', primaryKey: true },
    produto_id: { type: 'text', notNull: true, references: 'produtos_estoque(id)', onDelete: 'restrict' },
    tipo: { type: 'text', notNull: true },
    mensagem: { type: 'text' },
    lido: { type: 'boolean', default: false },
    criado_em: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })
  pgm.createIndex('alertas_estoque', 'produto_id')

  pgm.createTable('daily_receitas', {
    dia: { type: 'date', primaryKey: true },
    total: { type: 'numeric(10,2)', default: 0 }
  })

  pgm.createTable('odontogramas', {
    paciente_id: { type: 'text', primaryKey: true, references: 'pacientes(id)', onDelete: 'cascade' },
    estado_json: { type: 'text', notNull: true },
    atualizado_em: { type: 'timestamp', default: pgm.func('current_timestamp') },
    criado_em: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })

  pgm.createTable('configuracoes', {
    chave: { type: 'text', primaryKey: true },
    valor: { type: 'text', notNull: true },
    atualizado_em: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })

  pgm.sql(
    `INSERT INTO configuracoes (chave, valor)
     VALUES
       ('nome_clinica', 'DR. NETO ABREU'),
       ('telefone_clinica', ''),
       ('email_clinica', ''),
       ('endereco_clinica', ''),
       ('rodape_pdf', '')
     ON CONFLICT (chave) DO NOTHING`
  )
}

exports.down = (pgm) => {
  pgm.dropTable('configuracoes')
  pgm.dropTable('odontogramas')
  pgm.dropTable('daily_receitas')
  pgm.dropTable('alertas_estoque')
  pgm.dropTable('relatorios')
  pgm.dropTable('movimentacoes_estoque')
  pgm.dropTable('produtos_estoque')
  pgm.dropTable('consultas')
  pgm.dropTable('pacientes')
  pgm.dropTable('password_resets')
  pgm.dropTable('audit_logs')
  pgm.dropTable('usuarios')
}
