/* eslint-disable */

exports.shorthands = undefined

exports.up = (pgm) => {
  // Marca quando o lembrete de WhatsApp foi enviado, para evitar duplicidade.
  pgm.addColumn('consultas', {
    lembrete_whatsapp_enviado_em: { type: 'timestamp' }
  })

  pgm.createIndex('consultas', ['lembrete_whatsapp_enviado_em'], {
    name: 'idx_consultas_lembrete_whatsapp_enviado_em'
  })
}

exports.down = (pgm) => {
  pgm.dropIndex('consultas', ['lembrete_whatsapp_enviado_em'], {
    name: 'idx_consultas_lembrete_whatsapp_enviado_em'
  })
  pgm.dropColumn('consultas', 'lembrete_whatsapp_enviado_em')
}
