import { useEffect, useState } from "react"
import { pacientesService, consultasService } from '@services/api'
import './MarcarConsulta.css'

export default function MarcarConsulta() {
  const [pacientes, setPacientes] = useState([])
  const [procedimentos, setProcedimentos] = useState([])

  const [pacienteId, setPacienteId] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [hora, setHora] = useState('09:00')
  const [tipo, setTipo] = useState('Consulta Geral')
  const [valor, setValor] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const p = await pacientesService.listar()
        setPacientes(p || [])
      } catch (err) {
        console.error('Erro ao carregar pacientes', err)
      }
    }
    load()
  }, [])

  const adicionarProcedimento = () => {
    setProcedimentos([...procedimentos, { descricao: tipo, valor: valor || 0 }])
    setTipo('Consulta Geral')
    setValor('')
  }

  const removerProcedimento = (index) => {
    setProcedimentos(procedimentos.filter((_, i) => i !== index))
  }

  const handleSalvar = async () => {
    if (!pacienteId) return alert('Selecione um paciente')
    try {
      const payload = {
        paciente_id: pacienteId,
        data_hora: `${data} ${hora}`,
        tipo_consulta: tipo,
        valor: valor || 0,
        procedimentos: procedimentos,
        observacoes
      }
      await consultasService.agendar(payload)
      alert('Consulta agendada com sucesso')
      // reset
      setPacienteId('')
      setProcedimentos([])
      setObservacoes('')
    } catch (err) {
      console.error('Erro ao agendar', err)
      alert('Erro ao agendar: ' + (err.message || err))
    }
  }

  return (
    <div className="container">
      <div className="section">
        <div className="section-header">ATENDIMENTO</div>

        <div className="field">
          <label>Paciente</label>
          <select value={pacienteId} onChange={e => setPacienteId(e.target.value)}>
            <option value="">Selecionar paciente</option>
            {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>

        <div className="row">
          <div className="field">
            <label>Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>

          <div className="field">
            <label>Horário</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} />
          </div>
        </div>

        <div className="row" style={{marginTop:8}}>
          <div className="field flex">
            <label>Tipo de Procedimento — Valor</label>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <select value={tipo} onChange={e => setTipo(e.target.value)}>
                <option>Consulta Geral</option>
                <option>Limpeza</option>
                <option>Extração</option>
                <option>Restauração</option>
              </select>
              <input className="small" type="number" placeholder="R$ 0,00" value={valor} onChange={e => setValor(e.target.value)} />
              <button type="button" className="btn-add" onClick={adicionarProcedimento}>+</button>
            </div>
          </div>
        </div>

        <div className="field">
          <label>Observações</label>
          <textarea rows="3" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
        </div>
      </div>

      <div className="section">
        <div className="section-header">Procedimentos adicionados</div>
        <div className="tags">
          {procedimentos.length === 0 && <div className="muted">Nenhum procedimento adicionado</div>}
          {procedimentos.map((proc, index) => (
            <span key={index} className="tag">
              {proc.descricao}
              <button onClick={() => removerProcedimento(index)}>×</button>
            </span>
          ))}
        </div>
      </div>

      <div className="footer-actions">
        <button className="btn-secondary" onClick={() => {
          setProcedimentos([])
          setObservacoes('')
          setPacienteId('')
        }}>Cancelar</button>
        <button className="btn-primary" onClick={handleSalvar}>Salvar</button>
      </div>
    </div>
  )
}
