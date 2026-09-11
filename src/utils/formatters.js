export const money = (value) => `${Number(value || 0).toLocaleString('he-IL')} ₪`
export const dateLabel = (value) => value ? new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'לא נקבע'
