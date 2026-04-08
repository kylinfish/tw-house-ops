// verify-pipeline.mjs
import fs from 'node:fs'
import path from 'node:path'

export async function verifyPipeline({ rootDir = '.' } = {}) {
  const issues = []

  // Load canonical statuses from states.yml via regex (no YAML parser needed)
  const statesPath = path.join(rootDir, 'templates/states.yml')
  const statesRaw = fs.existsSync(statesPath) ? fs.readFileSync(statesPath, 'utf8') : ''
  const canonicalStatuses = new Set(
    (statesRaw.match(/- name: (\S+)/g) || []).map(m => m.replace('- name: ', ''))
  )

  // Check tracker.md exists
  const trackerPath = path.join(rootDir, 'data/tracker.md')
  if (!fs.existsSync(trackerPath)) {
    issues.push('MISSING: data/tracker.md not found')
    return issues
  }

  // Parse tracker rows and extract report references + statuses
  const trackerContent = fs.readFileSync(trackerPath, 'utf8')
  const trackerRows = trackerContent.split('\n')
    .filter(l => l.startsWith('| ') && !l.startsWith('| #') && !l.startsWith('|---'))

  const trackerReportRefs = new Set()
  for (const row of trackerRows) {
    const cols = row.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length < 10) continue
    const status = cols[8]   // 9th column (0-indexed): status
    const reportCol = cols[9] // 10th column: report link

    // Check canonical status
    if (canonicalStatuses.size > 0 && !canonicalStatuses.has(status)) {
      issues.push(`INVALID STATUS: "${status}" in tracker row: ${row.slice(0, 60)}`)
    }

    // Extract report filename from markdown link [001](reports/filename.md)
    const match = reportCol.match(/\(reports\/([^)]+)\)/)
    if (match) trackerReportRefs.add(match[1])
  }

  // Check all report files have a tracker entry
  const reportsDir = path.join(rootDir, 'reports')
  if (fs.existsSync(reportsDir)) {
    const reportFiles = fs.readdirSync(reportsDir).filter(f => f.endsWith('.md'))
    for (const file of reportFiles) {
      if (!trackerReportRefs.has(file)) {
        issues.push(`ORPHANED REPORT: reports/${file} has no tracker entry`)
      }
    }
  }

  // Check for unmerged TSVs
  const additionsDir = path.join(rootDir, 'batch/tracker-additions')
  if (fs.existsSync(additionsDir)) {
    const unmerged = fs.readdirSync(additionsDir).filter(f => f.endsWith('.tsv'))
    if (unmerged.length > 0) {
      issues.push(`UNMERGED TSVs: ${unmerged.length} file(s) pending merge: ${unmerged.join(', ')}`)
    }
  }

  return issues
}

// CLI entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  verifyPipeline().then(issues => {
    if (issues.length === 0) {
      console.log('✓ Pipeline integrity OK')
    } else {
      console.error('Pipeline issues found:')
      issues.forEach(i => console.error(' •', i))
      process.exit(1)
    }
  }).catch(err => { console.error(err); process.exit(1) })
}
