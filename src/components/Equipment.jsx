import { useEffect, useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { createDocument, deleteDocument, subscribeToCollection, updateDocument } from '../services/firestore'
import { parseEquipmentRows } from '../utils/equipmentImport'
import './Equipment.css'

export default function Equipment() {
  const [items, setItems] = useState([])
  const [drafts, setDrafts] = useState({})
  const [form, setForm] = useState({ name: '', category: '', quantity: '' })
  const [importData, setImportData] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => subscribeToCollection('equipment', setItems, (subscribeError) => {
    console.error(subscribeError)
    setError('לא הצלחנו לטעון את רשימת הציוד')
  }), [])

  const loadFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportData(null)
    setError('')
    try {
      setImportData({ fileName: file.name, rows: parseEquipmentRows(await readSheet(file)) })
    } catch (fileError) {
      setError(fileError.message || 'לא הצלחנו לקרוא את הקובץ')
    }
  }

  const addItems = async (rows, fileName) => {
    setSaving(true)
    setError('')
    try {
      await Promise.all(rows.map((item) => createDocument('equipment', {
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        usedQuantity: 0,
        currentQuantity: item.quantity,
        active: true,
        ...(fileName ? { importedFrom: fileName } : {}),
      })))
      setImportData(null)
      setForm({ name: '', category: '', quantity: '' })
    } catch (saveError) {
      console.error(saveError)
      setError('לא הצלחנו לשמור את כל הפריטים. כדאי לבדוק את רשימת הציוד לפני ניסיון נוסף.')
    } finally {
      setSaving(false)
    }
  }

  const saveManualItem = (event) => {
    event.preventDefault()
    const quantity = Number(form.quantity)
    if (!form.name.trim() || !Number.isFinite(quantity) || quantity <= 0) return
    addItems([{ name: form.name.trim(), category: form.category.trim(), quantity }])
  }

  const saveUsage = async (item) => {
    const usedQuantity = Number(drafts[item.id] ?? item.usedQuantity ?? 0)
    const initialQuantity = Number(item.quantity ?? item.currentQuantity ?? 0)
    if (!Number.isFinite(usedQuantity) || usedQuantity < 0 || usedQuantity > initialQuantity) {
      setError(`כמות השימוש של ${item.name} חייבת להיות בין אפס לכמות ההתחלתית`)
      return
    }
    setError('')
    try {
      await updateDocument('equipment', item.id, {
        usedQuantity,
        currentQuantity: Math.max(0, initialQuantity - usedQuantity),
      })
    } catch (saveError) {
      console.error(saveError)
      setError(`לא הצלחנו לעדכן את הכמות של ${item.name}`)
    }
  }

  const removeItem = async (item) => {
    if (!confirm(`למחוק את ${item.name} מרשימת הציוד?`)) return
    try {
      await deleteDocument('equipment', item.id)
    } catch (deleteError) {
      console.error(deleteError)
      setError(`לא הצלחנו למחוק את ${item.name}`)
    }
  }

  return <section className="page equipment-page">
    <div className="page-actions"><div><span className="eyebrow">ניהול משאבים</span><h2>ציוד</h2></div></div>
    <div className="panel equipment-import">
      <div className="equipment-import-heading"><div><h3>ייבוא מלאי מקובץ Excel</h3><p className="muted">עמודות נדרשות: שם פריט וכמות. אפשר להוסיף גם קטגוריה.</p></div><label className="primary cashbox-file-button">בחירת קובץ<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={loadFile} /></label></div>
      {importData && <div className="equipment-import-preview">
        <div className="equipment-import-summary"><strong>{importData.fileName}</strong><span>{importData.rows.length} פריטים לייבוא</span></div>
        <div className="equipment-table-wrap"><table className="equipment-table"><thead><tr><th>שם פריט</th><th>קטגוריה</th><th>כמות התחלתית</th></tr></thead><tbody>{importData.rows.map((item, index) => <tr key={`${item.name}-${index}`}><td>{item.name}</td><td>{item.category || '—'}</td><td>{item.quantity}</td></tr>)}</tbody></table></div>
        <button className="primary" type="button" disabled={saving} onClick={() => addItems(importData.rows, importData.fileName)}>{saving ? 'מוסיף...' : 'הוספת הפריטים למלאי'}</button>
      </div>}
    </div>
    {error && <p className="equipment-error" role="alert">{error}</p>}
    <form className="panel equipment-add-form" onSubmit={saveManualItem}>
      <h3>הוספת פריט ידנית</h3>
      <label>שם פריט<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
      <label>קטגוריה<input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} /></label>
      <label>כמות התחלתית<input required min="0.01" step="any" type="number" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
      <button className="primary" disabled={saving}>{saving ? 'שומר...' : 'הוספת ציוד'}</button>
    </form>
    <div className="panel equipment-inventory">
      <div className="panel-heading"><div><span className="eyebrow">מלאי</span><h3>פריטי ציוד</h3></div><span className="cashbox-count">{items.length} פריטים</span></div>
      {items.length ? <div className="equipment-table-wrap"><table className="equipment-table"><thead><tr><th>שם פריט</th><th>קטגוריה</th><th>כמות התחלתית</th><th>נעשה שימוש</th><th>כמות עדכנית</th><th></th></tr></thead><tbody>{items.map((item) => {
        const initialQuantity = Number(item.quantity ?? item.currentQuantity ?? 0)
        const usedQuantity = Number(item.usedQuantity ?? 0)
        const currentQuantity = Math.max(0, Number(item.currentQuantity ?? initialQuantity - usedQuantity))
        return <tr key={item.id}>
          <td>{item.name}</td><td>{item.category || '—'}</td><td>{initialQuantity}</td>
          <td><div className="equipment-usage"><input aria-label={`כמות שימוש עבור ${item.name}`} type="number" min="0" max={initialQuantity} step="any" value={drafts[item.id] ?? usedQuantity} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /><button type="button" className="ghost" onClick={() => saveUsage(item)}>עדכון</button></div></td>
          <td><strong className={currentQuantity === 0 ? 'equipment-out-of-stock' : ''}>{currentQuantity === 0 ? 'אין עוד' : currentQuantity}</strong></td>
          <td><button className="cashbox-delete" type="button" aria-label={`מחיקת פריט ${item.name}`} onClick={() => removeItem(item)}>×</button></td>
        </tr>
      })}</tbody></table></div> : <div className="empty">עדיין לא הוספתם פריטי ציוד</div>}
    </div>
  </section>
}