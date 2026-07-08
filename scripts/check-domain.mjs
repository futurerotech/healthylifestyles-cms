/**
 * CI guard: check that no file in src/ or scripts/ contains the wrong
 * domain spelling (single "s" in "lifestyles"). The correct
 * spelling has a double "s" (lifes-s-tyles).
 *
 * Usage: node scripts/check-domain.mjs
 * Exit 0 = pass, exit 1 = fail.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const WRONG = 'healthylifestyles' + '.com'  // constructed dynamically to avoid self-trigger
const CORRECT = 'healthylifesstyles.com'
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.json']
const ROOTS = ['src', 'scripts']
const EXTRA_FILES = ['payload.config.ts', 'next.config.mjs']

let bad = []

function scan(dir) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const entry of entries) {
    const full = join(dir, entry)
    let stat
    try { stat = statSync(full) } catch { continue }
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'migrations') continue
      scan(full)
    } else if (EXTENSIONS.includes(extname(entry))) {
      const content = readFileSync(full, 'utf8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(WRONG) && !lines[i].includes(CORRECT)) {
          bad.push(`${full}:${i + 1}: ${lines[i].trim().slice(0, 120)}`)
        }
      }
    }
  }
}

for (const root of ROOTS) scan(root)
for (const file of EXTRA_FILES) {
  try {
    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(WRONG) && !lines[i].includes(CORRECT)) {
        bad.push(`${file}:${i + 1}: ${lines[i].trim().slice(0, 120)}`)
      }
    }
  } catch { /* file may not exist */ }
}

if (bad.length > 0) {
  console.error('check:domain: FAIL — wrong domain spelling found:')
  bad.forEach((l) => console.error('  ' + l))
  process.exit(1)
} else {
  console.log('check:domain: PASS — no wrong-spelling occurrences')
  process.exit(0)
}
