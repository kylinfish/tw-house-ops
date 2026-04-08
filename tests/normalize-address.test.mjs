// tests/normalize-address.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAddress } from '../lib/normalize-address.mjs'

test('converts 臺 to 台', () => {
  assert.equal(normalizeAddress('臺北市信義區'), '台北市信義區')
})

test('normalizes floor suffix 三樓 to 3F', () => {
  assert.equal(normalizeAddress('台北市信義區忠孝東路五段1號三樓'), '台北市信義區忠孝東路五段1號3F')
})

test('normalizes floor suffix 3樓 to 3F', () => {
  assert.equal(normalizeAddress('台北市信義區忠孝東路五段1號3樓'), '台北市信義區忠孝東路五段1號3F')
})

test('keeps 3F as-is', () => {
  assert.equal(normalizeAddress('台北市信義區忠孝東路五段1號3F'), '台北市信義區忠孝東路五段1號3F')
})

test('strips 之 subdivisions for comparison', () => {
  assert.equal(normalizeAddress('台北市大安區和平東路一段1之3號'), '台北市大安區和平東路一段1號')
})

test('converts full-width digits and letters to half-width', () => {
  assert.equal(normalizeAddress('台北市信義區忠孝東路５段１號３Ｆ'), '台北市信義區忠孝東路5段1號3F')
})

test('removes spaces', () => {
  assert.equal(normalizeAddress('台北市 信義區 忠孝東路'), '台北市信義區忠孝東路')
})

test('handles combined transformations', () => {
  const input = '臺北市大安區和平東路一段１之３號 ３Ｆ'
  const expected = '台北市大安區和平東路一段1號3F'
  assert.equal(normalizeAddress(input), expected)
})
