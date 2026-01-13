const DEFAULT_API_URL = 'http://localhost:3001/api'
const API_URL = String(import.meta.env?.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, '')

const getToken = () => localStorage.getItem('token')

const api = async (endpoint, method = 'GET', body = null) => {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() && { 'Authorization': `Bearer ${getToken()}` })
    }
  }

  if (body) options.body = JSON.stringify(body)

  const response = await fetch(`${API_URL}${endpoint}`, options)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro na requisição')
  }

  return response.json()
}

const apiBlob = async (endpoint, method = 'GET', body = null) => {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() && { 'Authorization': `Bearer ${getToken()}` })
    }
  }

  if (body) options.body = JSON.stringify(body)

  const response = await fetch(`${API_URL}${endpoint}`, options)
  if (!response.ok) {
    let errorMsg = 'Erro na requisição'
    try {
      const err = await response.json()
      errorMsg = err.error || errorMsg
    } catch {
      // ignore
    }
    throw new Error(errorMsg)
  }

  return response.blob()
}

export const authService = {
  login: (email, senha) => api('/auth/login', 'POST', { email, senha }),
  register: (nome, email, senha, role) => api('/auth/register', 'POST', { nome, email, senha, role }),
  logout: () => api('/auth/logout', 'POST'),
  forgotPassword: (email) => api('/auth/forgot-password', 'POST', { email }),
  resetPassword: (token, novaSenha) => api('/auth/reset-password', 'POST', { token, novaSenha })
}

export const estoqueService = {
  listar: () => api('/estoque'),
  buscar: (id) => api(`/estoque/${id}`),
  criar: (dados) => api('/estoque', 'POST', dados),
  atualizar: (id, dados) => api(`/estoque/${id}`, 'PUT', dados),
  deletar: (id) => api(`/estoque/${id}`, 'DELETE'),
  movimentar: (id, dados) => api(`/estoque/${id}/movimentar`, 'POST', dados),
  alertas: () => api('/estoque/alertas/reposicao')
}

export const pacientesService = {
  listar: () => api('/pacientes'),
  buscar: (id) => api(`/pacientes/${id}`),
  criar: (dados) => api('/pacientes', 'POST', dados),
  atualizar: (id, dados) => api(`/pacientes/${id}`, 'PUT', dados),
  deletar: (id) => api(`/pacientes/${id}`, 'DELETE'),
  exportarProntuarioPDF: (id) => apiBlob(`/pacientes/${id}/prontuario/pdf`)
}

export const odontogramaService = {
  buscarPorPaciente: (pacienteId) => api(`/pacientes/${pacienteId}/odontograma`),
  salvarPorPaciente: (pacienteId, estado) => api(`/pacientes/${pacienteId}/odontograma`, 'PUT', { estado })
}

export const usuariosService = {
  listar: (role) => api(`/usuarios${role ? `?role=${role}` : ''}`),
  criar: (dados) => api('/usuarios', 'POST', dados),
  atualizar: (id, dados) => api(`/usuarios/${id}`, 'PUT', dados)
}

export const consultasService = {
  listar: () => api('/consultas'),
  porPaciente: (paciente_id) => api(`/consultas/paciente/${paciente_id}`),
  agendar: (dados) => api('/consultas', 'POST', dados),
  criar: (dados) => api('/consultas', 'POST', dados),
  deletar: (id) => api(`/consultas/${id}`, 'DELETE'),
  atualizar: (id, dados) => api(`/consultas/${id}/status`, 'PUT', dados),
  atualizarDados: (id, dados) => api(`/consultas/${id}`, 'PUT', dados),
  disponibilidade: (data) => api(`/consultas/disponibilidade/${data}`),
  metricasNaoFinalizadas: (data_inicio, data_fim, dentista_id) => {
    const qs = new URLSearchParams({
      ...(data_inicio ? { data_inicio } : {}),
      ...(data_fim ? { data_fim } : {}),
      ...(dentista_id ? { dentista_id } : {})
    }).toString()
    return api(`/consultas/metricas/nao-finalizadas${qs ? `?${qs}` : ''}`)
  }
}

export const relatoriosService = {
  estoque: () => api('/relatorios/estoque'),
  receita: (data_inicio, data_fim) => api(`/relatorios/receita?data_inicio=${data_inicio}&data_fim=${data_fim}`),
  agendamentos: () => api('/relatorios/agendamentos'),
  dashboard: () => api('/relatorios/dashboard'),
  dailyReceitas: () => api('/relatorios/daily-receitas'),
  exportarPDF: (tipo, dados) => api('/relatorios/exportar-pdf', 'POST', { tipo, dados }),
  exportarExcel: (tipo, dados) => api('/relatorios/exportar-excel', 'POST', { tipo, dados })
}

export const configuracoesService = {
  buscar: () => api('/configuracoes'),
  atualizar: (dados) => api('/configuracoes', 'PUT', dados)
}

export const auditoriaService = {
  listar: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api(`/auditoria${qs ? `?${qs}` : ''}`)
  }
}
