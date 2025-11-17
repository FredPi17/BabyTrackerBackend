import AdmZip from 'adm-zip'
import initSqlJs from 'sql.js'
import path from 'node:path'
import { createRequire } from 'node:module'

export interface BtbkTableDump {
  name: string
  rowCount: number
  rows: Record<string, unknown>[]
}

export interface BtbkJsonDump {
  generatedAt: string
  tables: Record<string, BtbkTableDump>
}

const nodeRequire = createRequire(__filename)
const sqlJsDir = path.dirname(nodeRequire.resolve('sql.js/package.json'))
const sqlDistDir = path.join(sqlJsDir, 'dist')
const sqlWasmPath = path.join(sqlDistDir, 'sql-wasm.wasm')

const sqlPromise = initSqlJs({
  locateFile: (file) => {
    if (file === 'sql-wasm.wasm') {
      return sqlWasmPath
    }
    return path.join(sqlDistDir, file)
  },
})

export async function parseBtbkArchive(input: Buffer | Uint8Array): Promise<BtbkJsonDump> {
  const zip = new AdmZip(input)
  const dbEntry = zip.getEntry('EasyLog.db')

  if (!dbEntry) {
    throw new Error('Archive BTBK invalide : fichier EasyLog.db introuvable')
  }

  const dbBuffer = dbEntry.getData()
  const SQL = await sqlPromise
  const database = new SQL.Database(new Uint8Array(dbBuffer))

  try {
    const tables = listTables(database)
    const tableDump: Record<string, BtbkTableDump> = {}

    for (const tableName of tables) {
      const rows = fetchRows(database, tableName)
      tableDump[tableName] = {
        name: tableName,
        rowCount: rows.length,
        rows,
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      tables: tableDump,
    }
  } finally {
    database.close()
  }
}

function listTables(database: Awaited<ReturnType<typeof initSqlJs>>['Database']) {
  const statement = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  const tables: string[] = []

  while (statement.step()) {
    const [name] = statement.get()
    if (typeof name === 'string') {
      tables.push(name)
    }
  }

  statement.free()
  return tables
}

function fetchRows(database: Awaited<ReturnType<typeof initSqlJs>>['Database'], tableName: string) {
  const statement = database.prepare(`SELECT * FROM "${tableName}"`)
  const columnNames = statement.getColumnNames()
  const rows: Record<string, unknown>[] = []

  while (statement.step()) {
    const values = statement.get()
    const row: Record<string, unknown> = {}
    values.forEach((value, index) => {
      row[columnNames[index]] = normalizeValue(value)
    })
    rows.push(row)
  }

  statement.free()
  return rows
}

function normalizeValue(value: unknown) {
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64')
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}
