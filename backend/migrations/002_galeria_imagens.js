// Migration para criar tabela galeria_imagens
module.exports = {
  up: async (db) => {
    await db.run(`
      CREATE TABLE IF NOT EXISTS galeria_imagens (
        id TEXT PRIMARY KEY,
        paciente_id TEXT NOT NULL,
        url TEXT NOT NULL,
        nome_arquivo TEXT,
        data_upload DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
      )
    `)
  },
  down: async (db) => {
    await db.run('DROP TABLE IF EXISTS galeria_imagens')
  }
}
