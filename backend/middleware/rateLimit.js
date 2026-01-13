const rateLimit = require('express-rate-limit')

function numEnv(name, fallback) {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function createJsonLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message }
  })
}

// Defaults pensados para proteger endpoints sensíveis sem atrapalhar uso normal.
const authLoginLimiter = createJsonLimiter({
  windowMs: numEnv('RATE_LIMIT_LOGIN_WINDOW_MS', 15 * 60 * 1000),
  limit: numEnv('RATE_LIMIT_LOGIN_MAX', 20),
  message: 'Muitas tentativas de login. Tente novamente em alguns minutos.'
})

const authRegisterLimiter = createJsonLimiter({
  windowMs: numEnv('RATE_LIMIT_REGISTER_WINDOW_MS', 15 * 60 * 1000),
  limit: numEnv('RATE_LIMIT_REGISTER_MAX', 10),
  message: 'Muitas tentativas de registro. Tente novamente em alguns minutos.'
})

const forgotPasswordLimiter = createJsonLimiter({
  windowMs: numEnv('RATE_LIMIT_FORGOT_WINDOW_MS', 15 * 60 * 1000),
  limit: numEnv('RATE_LIMIT_FORGOT_MAX', 10),
  message: 'Muitas solicitações. Tente novamente em alguns minutos.'
})

const resetPasswordLimiter = createJsonLimiter({
  windowMs: numEnv('RATE_LIMIT_RESET_WINDOW_MS', 15 * 60 * 1000),
  limit: numEnv('RATE_LIMIT_RESET_MAX', 10),
  message: 'Muitas solicitações. Tente novamente em alguns minutos.'
})

module.exports = {
  authLoginLimiter,
  authRegisterLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter
}
