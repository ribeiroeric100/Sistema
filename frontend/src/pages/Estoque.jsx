import { useEffect, useState } from 'react'
import styles from './Estoque.module.css'
import { estoqueService } from '@services/api'

export default function Estoque() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nome: '', categoria: '', quantidade: 0, preco_unitario: '', fornecedor: '', data_vencimento: '' })
  const [, setSaving] = useState(false)

  const carregar = async () => {
    try {
      const dados = await estoqueService.listar()
      setItems(dados)
    } catch (err) {
      console.error('Erro ao carregar estoque', err)
    }
  }

  useEffect(() => { carregar() }, [])

  const abrirNovo = () => {
    setEditing(null)
    setForm({ nome: '', categoria: '', quantidade: 0, preco_unitario: '', fornecedor: '', data_validade: '' })
    setShowNewForm(true)
  }

  const abrirEdicao = (item) => {
    setEditing(item.id)
    setForm({ nome: item.nome, categoria: item.categoria, quantidade: item.quantidade, preco_unitario: item.preco_unitario, fornecedor: item.fornecedor, data_vencimento: item.data_vencimento })
    setShowNewForm(true)
  }

  const salvar = async (e) => {
    e.preventDefault()
    setSaving(true)
    console.log('Salvando produto, payload:', form)
    try {
      let resp
      if (editing) {
        resp = await estoqueService.atualizar(editing, form)
      } else {
        resp = await estoqueService.criar(form)
      }
      console.log('Resposta do servidor:', resp)
      setShowNewForm(false)
      carregar()
    } catch (err) {
      console.error('Erro ao salvar produto', err)
      alert('Erro ao salvar produto: ' + (err.message || String(err)))
    } finally {
      setSaving(false)
    }
  }

  const remover = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return
    try {
      await estoqueService.deletar(id)
      carregar()
    } catch (err) {
      console.error('Erro ao deletar', err)
    }
  }

  const filteredItems = items.filter(item =>
    (item.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.categoria || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className={styles.container}>
      <h1>Estoque</h1>

      <div className={styles.searchSection}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Buscar item no estoque..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <button className={styles.btnBuscar} onClick={carregar}>Buscar</button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Quantidade</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={item.id}>
                <td>{item.nome}</td>
                <td>{item.categoria}</td>
                <td>{item.quantidade}</td>
                <td className={styles.actions}>
                  <button className={styles.editBtn} onClick={() => abrirEdicao(item)} title="Editar">✎</button>
                  <button className={styles.deleteBtn} onClick={() => remover(item.id)} title="Deletar">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <button className={styles.btnNovoItem} onClick={abrirNovo}>
          <span>+</span> Novo Item
        </button>
      </div>

      {showNewForm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{editing ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button className={styles.modalClose} onClick={() => setShowNewForm(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <form onSubmit={salvar} className={styles.form}>
                <label className={styles.formLabel}>Nome do Produto</label>
                <input className={styles.formInput} value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required />

                <label className={styles.formLabel}>Categoria</label>
                <select className={styles.formInput} value={form.categoria || ''} onChange={e => setForm({...form, categoria: e.target.value})}>
                  <option value="">- Selecionar categoria -</option>
                  <option value="consumivel">Consumível</option>
                  <option value="material">Material</option>
                  <option value="produto">Produto</option>
                </select>

                <div className={styles.twoCols}>
                  <div>
                    <label className={styles.formLabel}>Quantidade</label>
                    <input className={styles.formInput} type="number" value={form.quantidade} onChange={e => setForm({...form, quantidade: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className={styles.formLabel}>Preço</label>
                    <input className={styles.formInput} value={form.preco_unitario} onChange={e => setForm({...form, preco_unitario: e.target.value})} placeholder="R$ 0,00" />
                  </div>
                </div>

                <label className={styles.formLabel}>Fornecedor</label>
                <input className={styles.formInput} value={form.fornecedor} onChange={e => setForm({...form, fornecedor: e.target.value})} />

                <label className={styles.formLabel}>Data de Validade</label>
                <input className={styles.formInput} type="date" value={form.data_vencimento} onChange={e => setForm({...form, data_vencimento: e.target.value})} />

                <div className={styles.modalFooter}>
                  <div className={styles.modalFooterLeft}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setShowNewForm(false)}>Cancelar</button>
                  </div>
                  <div className={styles.modalFooterRight}>
                    <button type="submit" className={styles.btnPrimary}>{editing ? 'Salvar Produto' : 'Salvar Produto'}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
