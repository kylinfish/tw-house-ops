// dedup-tracker.mjs
import fs from 'node:fs'
import { normalizeAddress } from './lib/normalize-address.mjs'

export async function dedupTracker({ trackerPath = 'data/tracker.md' } = {}) {
  const content = fs.readFileSync(trackerPath, 'utf8')
  const lines = content.split('\n')

  const headerLines = []
  const dataLines = []
  let inData = false

  for (const line of lines) {
    if (line.startsWith('|---')) {
      headerLines.push(line)
      inData = true
    } else if (!inData) {
      headerLines.push(line)
    } else if (line.startsWith('| ') && !line.startsWith('| #')) {
      dataLines.push(line)
    }
    // blank lines and trailing content after the table are intentionally dropped
    // to prevent blank lines accumulating between data rows on repeated merges
  }

  const seen = new Set()
  const unique = []
  let removed = 0

  for (const row of dataLines) {
    const cols = row.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length < 4) {
      unique.push(row)
      continue
    }
    // Column order in table: # | date | portal | address | type | price | size | score | status | report | notes
    // After split/filter: [#, date, portal, address, type, price, size, score, status, report, notes]
    const address = cols[3] // 4th column (0-indexed)
    const key = normalizeAddress(address)
    if (seen.has(key)) {
      removed++
    } else {
      seen.add(key)
      unique.push(row)
    }
  }

  const result = headerLines.join('\n').replace(/\n+$/, '') + '\n' + unique.join('\n') + '\n'
  fs.writeFileSync(trackerPath, result)

  return removed
}

// CLI entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  dedupTracker().then(removed => {
    if (removed > 0) {
      console.log(`✓ Removed ${removed} duplicate(s)`)
    } else {
      console.log('• No duplicates found')
    }
  }).catch(err => {
    console.error(err)
    process.exit(1)
  })
}
