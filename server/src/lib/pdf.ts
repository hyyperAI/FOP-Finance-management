// Professional PDF generator using jsPDF Node.js build (Feature 10).
import { jsPDF } from 'jspdf/dist/jspdf.node.min.js'

export interface PdfTransaction {
  occurredAt: Date
  type: 'INTAKE' | 'EXPENSE'
  amount: string
  vendor: string | null
  description: string | null
  paymentMethod: string
  category: { name: string }
  subCategory: { name: string } | null
  postedBy: { name: string }
}

export interface PdfInput {
  orgName: string
  from: string
  to: string
  transactions: PdfTransaction[]
}

export function generateStatementPdf(input: PdfInput): Buffer {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 20

  // Calculations
  let balance = 0
  const rows = input.transactions.map((t) => {
    const a = Number(t.amount)
    balance += t.type === 'INTAKE' ? a : -a
    return { ...t, runningBalance: balance }
  })

  const totalIn = rows.filter(t => t.type === 'INTAKE').reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = rows.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0)
  const net = totalIn - totalOut

  let y = 20

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(input.orgName, margin, y)
  y += 8
  doc.setFontSize(12)
  doc.text('Financial Statement', margin, y)
  y += 8
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Period: ' + input.from + ' to ' + input.to, margin, y)
  y += 5
  doc.text('Generated: ' + new Date().toLocaleDateString('en-PK'), margin, y)
  y += 12

  // Summary
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('SUMMARY', margin, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.text('Total Income:  Rs ' + totalIn.toLocaleString('en-PK', { minimumFractionDigits: 2 }), margin, y)
  y += 6
  doc.text('Total Expense: Rs ' + totalOut.toLocaleString('en-PK', { minimumFractionDigits: 2 }), margin, y)
  y += 6
  doc.text('Net Balance:  Rs ' + net.toLocaleString('en-PK', { minimumFractionDigits: 2 }), margin, y)
  y += 12

  // Table header
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  const colX = {
    date: margin,
    type: margin + 25,
    cat: margin + 40,
    method: margin + 70,
    desc: margin + 90,
    amt: pageW - margin - 40,
    bal: pageW - margin,
  }
  doc.text('DATE', colX.date, y)
  doc.text('TYPE', colX.type, y)
  doc.text('CATEGORY', colX.cat, y)
  doc.text('METHOD', colX.method, y)
  doc.text('DESCRIPTION', colX.desc, y)
  doc.text('AMOUNT', colX.amt, y)
  doc.text('BALANCE', colX.bal, y)
  y += 4
  doc.setDrawColor(200)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  // Table rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const maxRows = 40
  const visible = rows.slice(0, maxRows)

  for (const t of visible) {
    if (y > 270) {
      doc.addPage()
      y = 20
    }

    const sign = t.type === 'INTAKE' ? '+' : '-'
    const amt = Math.abs(Number(t.amount))
    const desc = ((t.vendor || t.description) || '').toString().slice(0, 20) || '-'
    const date = new Date(t.occurredAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
    const catName = (t.category?.name || '-').slice(0, 12)

    if (t.type === 'INTAKE') {
      doc.setTextColor(39, 103, 73)
    } else {
      doc.setTextColor(197, 48, 48)
    }
    doc.text(t.type === 'INTAKE' ? 'IN' : 'OUT', colX.type, y)
    doc.setTextColor(0, 0, 0)

    doc.text(date, colX.date, y)
    doc.text(catName, colX.cat, y)
    doc.text(t.paymentMethod, colX.method, y)
    doc.text(desc, colX.desc, y)
    doc.text(sign + 'Rs ' + amt.toLocaleString('en-PK', { minimumFractionDigits: 2 }), colX.amt, y)
    doc.text('Rs ' + t.runningBalance.toLocaleString('en-PK', { minimumFractionDigits: 2 }), colX.bal, y)

    y += 6
  }

  y += 6
  doc.setDrawColor(200)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  // Totals
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('TOTALS', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Total Income:  Rs ' + totalIn.toLocaleString('en-PK', { minimumFractionDigits: 2 }), margin, y)
  y += 5
  doc.text('Total Expense: Rs ' + totalOut.toLocaleString('en-PK', { minimumFractionDigits: 2 }), margin, y)
  y += 5
  doc.text('Net Balance:  Rs ' + net.toLocaleString('en-PK', { minimumFractionDigits: 2 }), margin, y)

  // Footer on all pages
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(128, 128, 128)
    doc.text('Page ' + i + ' of ' + pageCount + ' | ' + input.orgName + ' | Confidential', pageW / 2, 290, { align: 'center' })
  }

  // Get buffer - use blob method for Node.js compatibility
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
