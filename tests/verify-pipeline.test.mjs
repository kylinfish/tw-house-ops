// tests/verify-pipeline.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { verifyPipeline } from '../verify-pipeline.mjs'

const FIXTURES = path.join(import.meta.dirname, 'fixtures/verify-pipeline')

before(() => {
  fs.mkdirSync(path.join(FIXTURES, 'reports'), { recursive: true })
  fs.mkdirSync(path.join(FIXTURES, 'batch/tracker-additions'), { recursive: true })
  fs.mkdirSync(path.join(FIXTURES, 'templates'), { recursive: true })
})

after(() => {
  fs.rmSync(FIXTURES, { recursive: true, force: true })
})

function makeTracker(rows) {
  const header = '# 物件追蹤\n\n| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |\n|---|------|------|------|------|------|------|------|------|------|------|\n'
  return header + rows.join('\n') + '\n'
}

test('returns no issues when everything is clean', async () => {
  const dir = path.join(FIXTURES, 'clean')
  fs.mkdirSync(path.join(dir, 'reports'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'batch/tracker-additions'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'templates'), { recursive: true })

  fs.writeFileSync(
    path.join(dir, 'data/tracker.md'),
    makeTracker(['| 001 | 2026-04-08 | 591 | 信義區 | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [001](reports/001-xinyi.md) | - |'])
  )
  fs.writeFileSync(path.join(dir, 'reports/001-xinyi.md'), '# 001')
  fs.writeFileSync(path.join(dir, 'templates/states.yml'), 'states:\n  - name: Evaluated\n  - name: Skip\n  - name: Visit\n  - name: Visited\n  - name: Pass\n  - name: Offer\n  - name: Negotiating\n  - name: Signed\n  - name: Done\n  - name: Expired\n  - name: Scanned\n')
  fs.writeFileSync(path.join(dir, 'batch/tracker-additions/.gitkeep'), '')

  const issues = await verifyPipeline({ rootDir: dir })
  assert.deepEqual(issues, [])
})

test('reports orphaned report files (no tracker entry)', async () => {
  const dir = path.join(FIXTURES, 'orphan')
  fs.mkdirSync(path.join(dir, 'reports'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'batch/tracker-additions'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'templates'), { recursive: true })

  fs.writeFileSync(path.join(dir, 'data/tracker.md'), makeTracker([]))
  fs.writeFileSync(path.join(dir, 'reports/001-xinyi.md'), '# 001')
  fs.writeFileSync(path.join(dir, 'templates/states.yml'), 'states: []')

  const issues = await verifyPipeline({ rootDir: dir })
  assert.ok(issues.some(i => i.includes('001-xinyi.md')))
})

test('reports unmerged TSV files', async () => {
  const dir = path.join(FIXTURES, 'unmerged')
  fs.mkdirSync(path.join(dir, 'reports'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'batch/tracker-additions'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'templates'), { recursive: true })

  fs.writeFileSync(path.join(dir, 'data/tracker.md'), makeTracker([]))
  fs.writeFileSync(path.join(dir, 'batch/tracker-additions/001-xinyi.tsv'), '001\tdata...')
  fs.writeFileSync(path.join(dir, 'templates/states.yml'), 'states: []')

  const issues = await verifyPipeline({ rootDir: dir })
  assert.ok(issues.some(i => i.includes('UNMERGED')))
})
