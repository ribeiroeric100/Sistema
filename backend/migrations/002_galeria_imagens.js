/* eslint-disable */

exports.shorthands = undefined

// Migração idempotente para criar tabela galeria_imagens (Postgres)
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS galeria_imagens (
      id TEXT PRIMARY KEY,
      paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      nome_arquivo TEXT,
      data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  pgm.sql('CREATE INDEX IF NOT EXISTS idx_galeria_imagens_paciente_id ON galeria_imagens (paciente_id);')
}

exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_galeria_imagens_paciente_id;')
  pgm.sql('DROP TABLE IF EXISTS galeria_imagens;')
}
