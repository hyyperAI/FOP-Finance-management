import { PrismaClient } from '@prisma/client'
import { generateStatementPdf } from '../src/lib/pdf.ts'
import * as fs from 'fs'

async function main() {
  const prisma = new PrismaClient()
  
  try {
    console.log('Fetching real transactions from database...')
    
    // Get transactions from last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const transactions = await prisma.transaction.findMany({
      where: {
        occurredAt: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        category: true,
        subCategory: true,
        postedBy: true,
      },
      orderBy: {
        occurredAt: 'asc',
      },
      take: 50, // Limit to 50 for readability
    })
    
    console.log(`Found ${transactions.length} transactions`)
    
    if (transactions.length === 0) {
      console.log('No transactions found. Creating sample PDF instead...')
    }
    
    const fromDate = transactions.length > 0 
      ? transactions[0].occurredAt.toISOString().slice(0, 10)
      : thirtyDaysAgo.toISOString().slice(0, 10)
    const toDate = transactions.length > 0
      ? transactions[transactions.length - 1].occurredAt.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    
    const pdfInput = {
      orgName: process.env.ORG_NAME || 'FOP Financial Management System',
      from: fromDate,
      to: toDate,
      transactions: transactions.map(t => ({
        occurredAt: t.occurredAt,
        type: t.type as 'INTAKE' | 'EXPENSE',
        amount: t.amount.toString(),
        vendor: t.vendor,
        description: t.description,
        paymentMethod: t.paymentMethod,
        category: t.category ?? { name: 'Unknown' },
        subCategory: t.subCategory ?? null,
        postedBy: t.postedBy ?? { name: 'Unknown' },
      })),
    }
    
    console.log('Generating PDF with real data...')
    const buffer = generateStatementPdf(pdfInput)
    console.log('PDF size:', buffer.length, 'bytes')
    
    const outputPath = './FOP-Real-Financial-Statement.pdf'
    fs.writeFileSync(outputPath, buffer)
    console.log('Saved to:', outputPath)
    
    // Also show summary
    const totalIn = transactions.filter(t => t.type === 'INTAKE').reduce((s, t) => s + Number(t.amount), 0)
    const totalOut = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0)
    console.log('\nSummary:')
    console.log('  Total Income:', totalIn.toLocaleString('en-PK', { style: 'currency', currency: 'PKR' }))
    console.log('  Total Expense:', totalOut.toLocaleString('en-PK', { style: 'currency', currency: 'PKR' }))
    console.log('  Net Balance:', (totalIn - totalOut).toLocaleString('en-PK', { style: 'currency', currency: 'PKR' }))
    
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
