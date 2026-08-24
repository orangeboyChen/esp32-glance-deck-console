import { readFile } from 'node:fs/promises'

const [reportPath, thresholdArgument] = process.argv.slice(2)
const threshold = Number(thresholdArgument)
if (!reportPath || !Number.isFinite(threshold)) throw new Error('usage: check-coverage <lcov-path> <minimum-percent>')

const report = await readFile(reportPath, 'utf8')
const lines = report.split('\n')
let found = 0
let hit = 0
for (const line of lines) {
  if (!line.startsWith('DA:')) continue
  const [, count] = line.slice(3).split(',')
  found += 1
  if (Number(count) > 0) hit += 1
}
if (found === 0) throw new Error('coverage report contains no executable lines')
const percentage = (hit / found) * 100
console.log(`line coverage: ${percentage.toFixed(2)}% (${hit}/${found})`)
if (percentage < threshold) throw new Error(`line coverage ${percentage.toFixed(2)}% is below ${threshold}%`)
