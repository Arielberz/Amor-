import { useEffect, useMemo, useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { createDocument, deleteDocument, subscribeToCollection } from '../services/firestore'
import { dateLabel, money } from '../utils/formatters'
import { parseExpenseRows } from '../utils/expenseImport'
import './Cashbox.css'
import './CashboxImport.css'

const today = () => new Date().toLocaleDateString('sv-SE')

export default function Cashbox() {
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState({ type: 'income', description: '', amount: '', date: today() })
  const [saving, setSaving] = useState(false)
  const [importData, setImportData] = useState(null)
  const [importError, setImportError] = useState('')

  useEffect(() => subscribeToCollection('cashbox', setEntries, (error) => console.error(error)), [])

  const totals = useMemo(() => entries.reduce((result, entry) => {
    result[entry.type] += Number(entry.amount || 0)
    return result
  }, { income: 0, expense: 0 }), [entries])

  const sortedEntries = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const saveEntry = async (event) => {
    event.preventDefault()
    if (!form.description.trim() || !form.date || Number(form.amount) <= 0) return
    setSaving(true)
    try {
      await createDocument('cashbox', { ...form, description: form.description.trim(), amount: Number(form.amount) })
      setForm((current) => ({ ...current, description: '', amount: '' }))
    } catch (error) {
      console.error(error)
      alert('לא הצלחנו לשמור את התנועה')
    } finally {
      setSaving(false)
    }
  }

  const removeEntry = async (entry) => {
    if (!confirm('למחוק את התנועה מהקופה?')) return
    try {
      await deleteDocument('cashbox', entry.id)
    } catch (error) {
      console.error(error)
      alert('לא הצלחנו למחוק את התנועה')
    }
  }

  const loadExpenseFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportData(null)
    setImportError('')
    try {
      setImportData({ fileName: file.name, rows: parseExpenseRows(await readSheet(file)) })
    } catch (error) {
      setImportError(error.message || 'לא הצלחנו לקרוא את הקובץ')
    }
  }

  const saveImportedExpenses = async () => {
    if (!importData || saving) return
    const amount = importData.rows.reduce((sum, row) => sum + row.amount, 0)
    setSaving(true)
    setImportError('')
    try {
      await createDocument('cashbox', {
        type: 'expense',
        description: `ייבוא הוצאות: ${importData.fileName}`,
        amount,
        date: today(),
        breakdown: importData.rows,
      })
      setImportData(null)
    } catch (error) {
      console.error(error)
      setImportError('לא הצלחנו לשמור את ההוצאות בקופה')
    } finally {
      setSaving(false)
    }
  }

  return <section className="page cashbox-page">
    <div className="page-actions">
      <div><span className="eyebrow">ניהול כספי</span><h2>קופה</h2><p className="muted">מעקב אחר הכנסות והוצאות העסק</p></div>
    </div>
    <div className="cashbox-totals">
      <div className="cashbox-total"><span>סך הכנסות</span><strong>{money(totals.income)}</strong></div>
      <div className="cashbox-total"><span>סך הוצאות</span><strong>{money(totals.expense)}</strong></div>
      <div className="cashbox-total cashbox-balance"><span>יתרה בקופה</span><strong>{money(totals.income - totals.expense)}</strong></div>
    </div>
    <div className="panel cashbox-import">
      <div className="cashbox-import-heading"><div><h3>ייבוא הוצאות מקובץ</h3><p className="muted">עמודות: שם פריט, עלות ליחידה, כמות, סה״כ עלות לפריט</p></div><label className="primary cashbox-file-button">בחירת קובץ<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={loadExpenseFile} /></label></div>
      {importError && <p className="cashbox-import-error" role="alert">{importError}</p>}
      {importData && <div className="cashbox-preview">
        <div className="cashbox-preview-summary"><strong>{importData.fileName}</strong><span>{importData.rows.length} הוצאות</span><strong>סה״כ: {money(importData.rows.reduce((sum, row) => sum + row.amount, 0))}</strong></div>
        <div className="cashbox-preview-table"><table><thead><tr><th>שם פריט</th><th>עלות ליחידה</th><th>כמות</th><th>סה״כ עלות לפריט</th></tr></thead><tbody>{importData.rows.map((row, index) => <tr key={`${row.description}-${index}`}><td>{row.description}</td><td>{row.unitCost == null ? '—' : money(row.unitCost)}</td><td>{row.quantity ?? '—'}</td><td>{money(row.amount)}</td></tr>)}</tbody></table></div>
        <button className="primary" type="button" disabled={saving} onClick={saveImportedExpenses}>{saving ? 'שומר...' : 'הוספת ההוצאות לקופה'}</button>
      </div>}
    </div>
    <form className="panel cashbox-form" onSubmit={saveEntry}>
      <div className="cashbox-form-heading"><h3>תנועה חדשה</h3><div className="cashbox-types" role="group" aria-label="סוג התנועה">
        <button type="button" className={form.type === 'income' ? 'selected income-choice' : ''} onClick={() => updateForm('type', 'income')}>הכנסה</button>
        <button type="button" className={form.type === 'expense' ? 'selected expense-choice' : ''} onClick={() => updateForm('type', 'expense')}>הוצאה</button>
      </div></div>
      <div className="cashbox-fields">
        <label>תיאור<input required value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="למשל: מקדמה או תשלום לספק" /></label>
        <label>סכום<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => updateForm('amount', event.target.value)} placeholder="0" /></label>
        <label>תאריך<input required type="date" value={form.date} onChange={(event) => updateForm('date', event.target.value)} /></label>
        <button className="primary cashbox-submit" disabled={saving}>{saving ? 'שומר...' : 'הוספת תנועה'}</button>
      </div>
    </form>
    <div className="panel cashbox-ledger">
      <div className="panel-heading"><div><span className="eyebrow">תנועות</span><h3>יומן הקופה</h3></div><span className="cashbox-count">{entries.length} תנועות</span></div>
      {sortedEntries.length ? <div className="cashbox-list">{sortedEntries.map((entry) => <div className="cashbox-row" key={entry.id}>
        <span className={`cashbox-kind ${entry.type}`}>{entry.type === 'income' ? 'הכנסה' : 'הוצאה'}</span>
        <div className="cashbox-description"><strong>{entry.description}</strong><small>{dateLabel(entry.date)}</small>{entry.breakdown?.length > 0 && <details className="cashbox-breakdown"><summary>פירוט {entry.breakdown.length} הוצאות</summary><ul>{entry.breakdown.map((row, index) => <li key={`${row.description}-${index}`}><span>{row.description}{row.unitCost != null ? ` · ${money(row.unitCost)} × ${row.quantity}` : ''}{row.date ? ` · ${row.date}` : ''}</span><strong>{money(row.amount)}</strong></li>)}</ul></details>}</div>
        <strong className={`cashbox-amount ${entry.type}`}>{entry.type === 'income' ? '+' : '−'}{money(entry.amount)}</strong>
        <button className="cashbox-delete" type="button" aria-label={`מחיקת תנועה: ${entry.description}`} title="מחיקת תנועה" onClick={() => removeEntry(entry)}>×</button>
      </div>)}</div> : <div className="empty">עדיין לא נרשמו תנועות בקופה</div>}
    </div>
  </section>
}