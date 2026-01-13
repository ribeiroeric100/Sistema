function formatZodIssues(issues) {
  return (issues || [])
    .map((i) => {
      const path = (i.path || []).join('.')
      return path ? `${path}: ${i.message}` : i.message
    })
    .join('; ')
}

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: formatZodIssues(result.error.issues) || 'Dados inválidos' })
    }
    req.body = result.data
    next()
  }
}

module.exports = { validateBody }
