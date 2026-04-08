// merge-tracker.mjs
import fs from 'node:fs'
import path from 'node:path'

export async function mergeTSV({
  trackerPath = 'data/tracker.md',
  additionsDir = 'batch/tracker-additions',
  processedDir = 'batch/tracker-additions/processed'
} = {}) {
  fs.mkdirSync(processedDir, { recursive: true })

  const files = fs.readdirSync(additionsDir)
    .filter(f => f.endsWith('.tsv'))
    .sort()

  if (files.length === 0) {
    console.log('No TSV files to merge.')
    return
  }

  let tracker = fs.readFileSync(trackerPath, 'utf8')
  let merged = 0

  for (const file of files) {
    const filePath = path.join(additionsDir, file)
    const content = fs.readFileSync(filePath, 'utf8').trim()
    if (!content) continue

    const cols = content.split('\t')
    if (cols.length !== 11) {
      console.warn(`Skipping ${file}: expected 11 columns, got ${cols.length}`)
      continue
    }

    const [num, date, portal, address, type, price, size, score, status, report, notes] = cols
    const row = `| ${num} | ${date} | ${portal} | ${address} | ${type} | ${price} | ${size} | ${score} | ${status} | ${report} | ${notes} |`

    tracker = tracker.trimEnd() + '\n' + row + '\n'

    fs.renameSync(filePath, path.join(processedDir, file))
    merged++
  }

  fs.writeFileSync(trackerPath, tracker)
  console.log(`Merged ${merged} TSV file(s) into ${trackerPath}`)
}

// CLI entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  mergeTSV().catch(err => { console.error(err); process.exit(1) })
}
