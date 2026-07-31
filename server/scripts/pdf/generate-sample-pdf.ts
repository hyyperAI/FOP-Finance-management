import { generateStatementPdf } from './src/lib/pdf.ts'
import * as fs from 'fs'

const testInput = {
  orgName: 'FOP Financial Management System',
  from: '2026-07-01',
  to: '2026-07-30',
  transactions: [
    {
      occurredAt: new Date('2026-07-15'),
      type: 'INTAKE' as const,
      amount: '50000',
      vendor: 'Donation Collection',
      description: 'Monthly donation drive',
      paymentMethod: 'CASH',
      category: { name: 'Donations' },
      subCategory: { name: 'Monthly' },
      postedBy: { name: 'Aisha Admin' },
    },
    {
      occurredAt: new Date('2026-07-20'),
      type: 'EXPENSE' as const,
      amount: '2500',
      vendor: 'Grocery Store',
      description: 'Kitchen supplies',
      paymentMethod: 'CASH',
      category: { name: 'Kitchen' },
      subCategory: { name: 'Groceries' },
      postedBy: { name: 'Faiz Khan' },
    },
    {
      occurredAt: new Date('2026-07-25'),
      type: 'EXPENSE' as const,
      amount: '1500',
      vendor: 'Stationery Shop',
      description: 'Office supplies',
      paymentMethod: 'BANK',
      category: { name: 'Admin' },
      subCategory: { name: 'Supplies' },
      postedBy: { name: 'Aisha Admin' },
    },
  ],
}

console.log('Generating sample PDF...')
const buffer = generateStatementPdf(testInput)
console.log('PDF size:', buffer.length, 'bytes')

const outputPath = './FOP-Financial-Statement-Sample.pdf'
fs.writeFileSync(outputPath, buffer)
console.log('Saved to:', outputPath)
