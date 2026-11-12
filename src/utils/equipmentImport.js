const normalizeHeader = (value) => String(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const nameHeaders = ['שם פריט', 'שם הציוד', 'שם', 'פריט', 'ציוד', 'item name', 'item', 'name', 'equipment'].map(normalizeHeader)
const quantityHeaders = ['כמות', 'כמות התחלתית', 'מלאי', 'כמות במלאי', 'quantity', 'qty', 'stock'].map(normalizeHeader)
const categoryHeaders = ['קטגוריה', 'סוג', 'category', 'type'].map(normalizeHeader)

export const parseEquipmentRows = (data) => {
  if (!data.length) throw new Error('הגיליון ריק או שאין בו שורת כותרות')
  const headers = data[0].map((header) => String(header || ''))
  const findColumn = (aliases) => headers.findIndex((header) => aliases.includes(normalizeHeader(header)))
  const nameIndex = findColumn(nameHeaders)
  const quantityIndex = findColumn(quantityHeaders)
  const categoryIndex = findColumn(categoryHeaders)
  if (nameIndex < 0 || quantityIndex < 0) throw new Error('נדרשות עמודות בשם פריט וכמות')

  const rows = []
  data.slice(1).forEach((cells, index) => {
    const name = String(cells[nameIndex] || '').trim()
    const rawQuantity = cells[quantityIndex] ?? ''
    const category = categoryIndex < 0 ? '' : String(cells[categoryIndex] || '').trim()
    if (!name && !String(rawQuantity).trim() && !category) return
    const quantity = typeof rawQuantity === 'number' ? rawQuantity : Number(String(rawQuantity).replace(/,/g, '').trim())
    if (!name || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`יש לבדוק את שם הפריט והכמות בשורה ${index + 2}`)
    }
    rows.push({ name, category, quantity })
  })
  if (!rows.length) throw new Error('לא נמצאו פריטי ציוד תקינים בקובץ')
  return rows
}