// tests/merge-tracker.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mergeTSV } from '../merge-tracker.mjs'

const FIXTURES = path.join(import.meta.dirname, 'fixtures/merge-tracker')

before(() => {
  fs.mkdirSync(FIXTURES, { recursive: true })
  fs.mkdirSync(path.join(FIXTURES, 'batch/tracker-additions/processed'), { recursive: true })
})

after(() => {
  fs.rmSync(FIXTURES, { recursive: true, force: true })
})

test('appends TSV row to tracker.md', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker.md')
  const additionsDir = path.join(FIXTURES, 'batch/tracker-additions')

  // Write empty tracker
  fs.writeFileSync(trackerPath,
    '# 物件追蹤\n\n| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |\n|---|------|------|------|------|------|------|------|------|------|------|\n'
  )

  // Write a TSV addition
  const tsv = '001\t2026-04-08\t591\t信義區忠孝東路五段1號3F\t租\t22,000/月\t15坪\t4.2/5\tEvaluated\t[001](reports/001-...)\t無電梯\n'
  fs.writeFileSync(path.join(additionsDir, '001-xinyi.tsv'), tsv)

  await mergeTSV({ trackerPath, additionsDir, processedDir: path.join(additionsDir, 'processed') })

  const content = fs.readFileSync(trackerPath, 'utf8')
  assert.ok(content.includes('| 001 |'), 'tracker should contain new row')
  assert.ok(content.includes('信義區忠孝東路五段1號3F'), 'tracker should contain address')
})

test('moves processed TSV to processed/ directory', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker2.md')
  const additionsDir = path.join(FIXTURES, 'batch/tracker-additions')
  const processedDir = path.join(additionsDir, 'processed')

  fs.writeFileSync(trackerPath,
    '# 物件追蹤\n\n| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |\n|---|------|------|------|------|------|------|------|------|------|------|\n'
  )

  const tsv = '002\t2026-04-08\t591\t大安區和平東路一段1號5F\t買\t1,280萬\t28坪\t3.8/5\tEvaluated\t[002](reports/002-...)\t-\n'
  const tsvPath = path.join(additionsDir, '002-daan.tsv')
  fs.writeFileSync(tsvPath, tsv)

  await mergeTSV({ trackerPath, additionsDir, processedDir })

  assert.ok(!fs.existsSync(tsvPath), 'original TSV should be removed')
  assert.ok(fs.existsSync(path.join(processedDir, '002-daan.tsv')), 'TSV should be in processed/')
})

test('skips .gitkeep files in additions dir', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker3.md')
  const additionsDir = path.join(FIXTURES, 'batch/tracker-additions')

  fs.writeFileSync(trackerPath,
    '# 物件追蹤\n\n| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |\n|---|------|------|------|------|------|------|------|------|------|------|\n'
  )
  fs.writeFileSync(path.join(additionsDir, '.gitkeep'), '')

  // Should not throw
  await mergeTSV({ trackerPath, additionsDir, processedDir: path.join(additionsDir, 'processed') })

  const content = fs.readFileSync(trackerPath, 'utf8')
  // Only header, no new rows
  const rows = content.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| #') && !l.startsWith('|---'))
  assert.equal(rows.length, 0)
})
