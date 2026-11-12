const normalizeHeader = (value) => String(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const descriptionHeaders = ['שם פריט', 'תיאור', 'פריט', 'הוצאה', 'פירוט', 'שם הוצאה', 'סעיף', 'שם', 'description', 'item', 'expense', 'details', 'name'].map(normalizeHeader)
const unitCostHeaders = ['עלות ליחידה', 'מחיר ליחידה', 'unit cost', 'unit price'].map(normalizeHeader)
const quantityHeaders = ['כמות', 'quantity', 'qty'].map(normalizeHeader)
const lineTotalHeaders = ['סה״כ עלות לפריט', 'סהכ עלות לפריט', 'עלות כוללת לפריט', 'total item cost', 'line total'].map(normalizeHeader)
const amountHeaders = ['סכום', 'עלות', 'מחיר', 'סהכ', 'סך הכל', 'סהכ לתשלום', 'amount', 'total', 'price', 'cost', 'sum', 'value'].map(normalizeHeader)

const parseAmount = (value) => {
  let amount = String(value).trim().replace(/[^\d.,-]/g, '')
  const comma = amount.lastIndexOf(',')
  const dot = amount.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? ',' : '.'
    amount = amount.replace(decimalSeparator === ',' ? /\./g : /,/g, '')
    if (decimalSeparator === ',') amount = amount.replace(',', '.')
  } else if (comma >= 0) {
    amount = /,\d{1,2}$/.test(amount) ? amount.replace(',', '.') : amount.replace(/,/g, '')
  } else if (/\.\d{3}$/.test(amount)) {
    amount = amount.replace('.', '')
  }
  return Number(amount)
}

export const parseExpenseRows = (data) => {
  if (!data.length) throw new Error('הגיליון ריק או שאין בו שורת כותרות')
  const headers = data[0].map((header) => String(header || ''))
  const findColumn = (aliases) => headers.findIndex((header) => aliases.includes(normalizeHeader(header)))
  const descriptionIndex = findColumn(descriptionHeaders)
  const unitCostIndex = findColumn(unitCostHeaders)
  const quantityIndex = findColumn(quantityHeaders)
  const lineTotalIndex = findColumn(lineTotalHeaders)
  const dateIndex = headers.findIndex((header) => ['תאריך', 'date'].includes(normalizeHeader(header)))
  const itemized = [unitCostIndex, quantityIndex, lineTotalIndex].some((index) => index >= 0)
  const amountIndex = findColumn(amountHeaders)

  if (itemized && [descriptionIndex, unitCostIndex, quantityIndex, lineTotalIndex].some((index) => index < 0)) {
    throw new Error('נדרשות עמודות: שם פריט, עלות ליחידה, כמות וסה״כ עלות לפריט')
  }
  if (!itemized && (descriptionIndex < 0 || amountIndex < 0)) {
    throw new Error('נדרשות עמודות בשם תיאור וסכום, או ארבע עמודות פירוט הפריט')
  }

  const rows = []
  data.slice(1).forEach((cells, index) => {
    const description = String(cells[descriptionIndex] || '').trim()
    const rawAmount = itemized ? cells[lineTotalIndex] ?? '' : cells[amountIndex] ?? ''
    const rawUnitCost = itemized ? cells[unitCostIndex] ?? '' : ''
    const rawQuantity = itemized ? cells[quantityIndex] ?? '' : ''
    if (!description && !String(rawAmount).trim() && !String(rawUnitCost).trim() && !String(rawQuantity).trim()) return

    let amount = parseAmount(rawAmount)
    let unitCost
    let quantity
    if (itemized) {
      unitCost = parseAmount(rawUnitCost)
      quantity = parseAmount(rawQuantity)
      if (!Number.isFinite(unitCost) || unitCost <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`יש לבדוק את עלות היחידה והכמות בשורה ${index + 2}`)
      }
      amount = Math.round((unitCost * quantity + Number.EPSILON) * 100) / 100
      if (String(rawAmount).trim()) {
        const declaredAmount = parseAmount(rawAmount)
        if (!Number.isFinite(declaredAmount) || Math.abs(declaredAmount - amount) > 0.01) {
          throw new Error(`הסה״כ בשורה ${index + 2} אינו תואם לעלות ליחידה כפול הכמות`)
        }
      }
    }

    if (!description || !Number.isFinite(amount) || amount <= 0) {
      throw new Error(`יש לבדוק את שם הפריט והסכום בשורה ${index + 2}`)
    }
    const date = dateIndex < 0 ? '' : cells[dateIndex]
    rows.push({
      description,
      amount,
      ...(itemized ? { unitCost, quantity } : {}),
      date: date instanceof Date ? date.toLocaleDateString('sv-SE', { timeZone: 'UTC' }) : String(date || '').trim(),
    })
  })
  if (!rows.length) throw new Error('לא נמצאו שורות הוצאה תקינות בקובץ')
  return rows
}