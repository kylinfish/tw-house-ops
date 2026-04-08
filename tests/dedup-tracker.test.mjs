// tests/dedup-tracker.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { dedupTracker } from '../dedup-tracker.mjs'

const FIXTURES = path.join(import.meta.dirname, 'fixtures/dedup-tracker')

before(() => fs.mkdirSync(FIXTURES, { recursive: true }))
after(() => fs.rmSync(FIXTURES, { recursive: true, force: true }))

const HEADER = '# 物件追蹤\n\n| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |\n|---|------|------|------|------|------|------|------|------|------|------|\n'

test('removes duplicate rows with same normalized address', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker.md')
  fs.writeFileSync(trackerPath,
    HEADER +
    '| 001 | 2026-04-08 | 591 | 信義區忠孝東路五段1號3F | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [001](reports/001.md) | - |\n' +
    '| 002 | 2026-04-09 | 樂屋 | 信義區忠孝東路五段1號三樓 | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [002](reports/002.md) | dup |\n'
  )

  const removed = await dedupTracker({ trackerPath })
  assert.equal(removed, 1)

  const content = fs.readFileSync(trackerPath, 'utf8')
  const rows = content.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| #') && !l.startsWith('|---'))
  assert.equal(rows.length, 1)
  assert.ok(rows[0].includes('001'))
})

test('keeps rows with different addresses', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker2.md')
  fs.writeFileSync(trackerPath,
    HEADER +
    '| 001 | 2026-04-08 | 591 | 信義區忠孝東路五段1號3F | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [001](reports/001.md) | - |\n' +
    '| 002 | 2026-04-09 | 591 | 大安區和平東路一段5號2F | 租 | 19,000/月 | 13坪 | 3.8/5 | Evaluated | [002](reports/002.md) | - |\n'
  )

  const removed = await dedupTracker({ trackerPath })
  assert.equal(removed, 0)

  const content = fs.readFileSync(trackerPath, 'utf8')
  const rows = content.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| #') && !l.startsWith('|---'))
  assert.equal(rows.length, 2)
})

test('removes only duplicate, keeps first occurrence', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker3.md')
  fs.writeFileSync(trackerPath,
    HEADER +
    '| 001 | 2026-04-08 | 591 | 台北市信義區忠孝東路五段1號3F | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [001](reports/001.md) | older |\n' +
    '| 002 | 2026-04-09 | 樂屋 | 臺北市信義區忠孝東路五段1號三樓 | 租 | 23,000/月 | 15坪 | 4.3/5 | Evaluated | [002](reports/002.md) | newer |\n'
  )

  const removed = await dedupTracker({ trackerPath })
  assert.equal(removed, 1)

  const content = fs.readFileSync(trackerPath, 'utf8')
  const rows = content.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| #') && !l.startsWith('|---'))
  assert.equal(rows.length, 1)
  assert.ok(rows[0].includes('older'), 'should keep first occurrence')
})

test('handles empty tracker', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker4.md')
  fs.writeFileSync(trackerPath, HEADER)

  const removed = await dedupTracker({ trackerPath })
  assert.equal(removed, 0)
})

test('handles multiple duplicates of same address', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker5.md')
  fs.writeFileSync(trackerPath,
    HEADER +
    '| 001 | 2026-04-08 | 591 | 信義區忠孝東路五段1號3F | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [001](reports/001.md) | - |\n' +
    '| 002 | 2026-04-09 | 樂屋 | 信義區忠孝東路五段1號三樓 | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [002](reports/002.md) | dup1 |\n' +
    '| 003 | 2026-04-10 | 房屋比價 | 信義區 忠孝東路五段 1號 3F | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [003](reports/003.md) | dup2 |\n'
  )

  const removed = await dedupTracker({ trackerPath })
  assert.equal(removed, 2)

  const content = fs.readFileSync(trackerPath, 'utf8')
  const rows = content.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| #') && !l.startsWith('|---'))
  assert.equal(rows.length, 1)
  assert.ok(rows[0].includes('001'))
})

test('preserves header and formatting', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker6.md')
  fs.writeFileSync(trackerPath,
    HEADER +
    '| 001 | 2026-04-08 | 591 | 信義區忠孝東路五段1號3F | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [001](reports/001.md) | - |\n'
  )

  await dedupTracker({ trackerPath })

  const content = fs.readFileSync(trackerPath, 'utf8')
  assert.ok(content.startsWith('# 物件追蹤'), 'should preserve title')
  assert.ok(content.includes('| # | 日期 | 平台'), 'should preserve header row')
  assert.ok(content.includes('|---|------|------|'), 'should preserve separator row')
})
