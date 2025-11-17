import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseBtbkArchive } from '../src/integrations/parsers/btbk-parser'

async function main() {
  const [input, outputArg] = process.argv.slice(2)

  if (!input) {
    console.error('Usage : npm run btbk:json -- <fichier.btbk> [fichier.json]')
    process.exit(1)
  }

  const resolvedInput = path.resolve(process.cwd(), input)
  const outputPath = path.resolve(
    process.cwd(),
    outputArg ?? `${path.basename(resolvedInput, path.extname(resolvedInput))}.json`,
  )

  console.log(`Lecture de l’archive BTBK : ${resolvedInput}`)
  const buffer = await fs.readFile(resolvedInput)
  const dump = await parseBtbkArchive(buffer)

  await fs.writeFile(outputPath, JSON.stringify(dump, null, 2), 'utf8')
  console.log(`Export JSON terminé → ${outputPath}`)
}

main().catch((error) => {
  console.error('Impossible de convertir le fichier BTBK :', error)
  process.exit(1)
})
