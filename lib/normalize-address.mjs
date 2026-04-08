// lib/normalize-address.mjs

/**
 * Normalize a Taiwan address for cross-platform deduplication.
 * Rules:
 *  1. 臺 → 台
 *  2. Floor suffixes: N樓 / 三樓 etc. → NF
 *  3. Strip 之 subdivisions: 1之3號 → 1號
 *  4. Full-width → half-width (digits and ASCII letters)
 *  5. Remove spaces
 */
export function normalizeAddress(address) {
  let s = address

  // Rule 1: 臺 → 台
  s = s.replace(/臺/g, '台')

  // Rule 4: Full-width digits (０-９) and letters (Ａ-Ｚ, ａ-ｚ) → half-width
  s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  s = s.replace(/[Ａ-Ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  s = s.replace(/[ａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))

  // Rule 3: Strip 之 subdivisions — "1之3號" → "1號", "2之1" → "2"
  s = s.replace(/(\d+)之\d+/g, '$1')

  // Rule 2: Floor normalization
  // Chinese ordinal floors: 一樓..十樓 → 1F..10F
  const chineseNums = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 }
  s = s.replace(/([一二三四五六七八九十]+)樓/g, (_, cn) => {
    const num = chineseNums[cn]
    return num ? `${num}F` : `${cn}F`
  })
  // Numeric floors: 3樓 → 3F
  s = s.replace(/(\d+)樓/g, '$1F')

  // Rule 5: Remove spaces
  s = s.replace(/\s+/g, '')

  return s
}
