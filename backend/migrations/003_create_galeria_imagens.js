/* eslint-disable */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('galeria_imagens', {
    id: { type: 'text', primaryKey: true },
    paciente_id: { type: 'text', notNull: true, references: 'pacientes(id)', onDelete: 'cascade' },
    url: { type: 'text', notNull: true },
    nome_arquivo: { type: 'text' },
    data_upload: { type: 'timestamp', default: pgm.func('current_timestamp') }
  })

  pgm.createIndex('galeria_imagens', 'paciente_id', { name: 'idx_galeria_imagens_paciente_id' })
}

exports.down = (pgm) => {
  pgm.dropTable('galeria_imagens')
}
