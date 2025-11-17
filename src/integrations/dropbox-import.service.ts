import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { DateTime } from 'luxon'
import { Model, Types } from 'mongoose'
import { DailyLog, DailyLogDocument } from '../logs/schemas/daily-log.schema'
import { IntegrationImport, IntegrationImportDocument } from './schemas/integration-import.schema'
import { parseBtbkArchive } from './parsers/btbk-parser'

interface SleepEntry {
  id: string
  start: DateTime
  durationMinutes: number
  note?: string
  type: 'night' | 'nap'
}

interface DiaperEntry {
  id: string
  time: DateTime
  status: string
  note?: string
}

interface MedicineEntry {
  id: string
  time: DateTime
  name: string
  amount?: number
  note?: string
}

interface DailyAggregate {
  date: string
  sleepEntries: SleepEntry[]
  diaperEntries: DiaperEntry[]
  medicineEntries: MedicineEntry[]
}

@Injectable()
export class DropboxImportService {
  private readonly logger = new Logger(DropboxImportService.name)
  private readonly timezone: string

  constructor(
    @InjectModel(DailyLog.name) private readonly dailyLogModel: Model<DailyLogDocument>,
    @InjectModel(IntegrationImport.name) private readonly importModel: Model<IntegrationImportDocument>,
  ) {
    this.timezone = process.env.DROPBOX_IMPORT_TIMEZONE || 'Europe/Paris'
  }

  async importArchive(buffer: Buffer) {
    const dump = await parseBtbkArchive(buffer)
    const aggregates = this.buildAggregates(dump)
    const summary = [] as Array<{ date: string; newEntries: number; skipped: number }>

    for (const aggregate of aggregates) {
      const result = await this.applyAggregate(aggregate)
      summary.push({ date: aggregate.date, ...result })
    }

    return { summary }
  }

  private buildAggregates(dump: Awaited<ReturnType<typeof parseBtbkArchive>>) {
    const medicineMap = new Map<string, string>()
    const medSelection = dump.tables.MedicineSelection?.rows ?? []
    for (const entry of medSelection) {
      if (entry.ID) {
        medicineMap.set(String(entry.ID), String(entry.Name ?? entry.Description ?? ''))
      }
    }

    const map = new Map<string, DailyAggregate>()

    const sleepRows = dump.tables.Sleep?.rows ?? []
    for (const row of sleepRows) {
      const entry = this.mapSleep(row)
      if (!entry) continue
      const bucket = this.getOrCreateBucket(map, entry.start.toISODate()!)
      bucket.sleepEntries.push(entry)
    }

    const diaperRows = dump.tables.Diaper?.rows ?? []
    for (const row of diaperRows) {
      const entry = this.mapDiaper(row)
      if (!entry) continue
      const bucket = this.getOrCreateBucket(map, entry.time.toISODate()!)
      bucket.diaperEntries.push(entry)
    }

    const medicineRows = dump.tables.Medicine?.rows ?? []
    for (const row of medicineRows) {
      const entry = this.mapMedicine(row, medicineMap)
      if (!entry) continue
      const bucket = this.getOrCreateBucket(map, entry.time.toISODate()!)
      bucket.medicineEntries.push(entry)
    }

    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  private mapSleep(row: any): SleepEntry | null {
    if (!row.ID || !row.Time) {
      return null
    }
    const start = DateTime.fromSeconds(Number(row.Time), { zone: this.timezone })
    if (!start.isValid) {
      return null
    }
    const durationMinutes = Number(row.Duration ?? 0)
    const hour = start.hour
    const type = hour >= 19 || hour < 8 ? 'night' : 'nap'
    return {
      id: String(row.ID),
      start,
      durationMinutes,
      note: row.Note ? String(row.Note) : undefined,
      type,
    }
  }

  private mapDiaper(row: any): DiaperEntry | null {
    if (!row.ID || !row.Time) {
      return null
    }
    const time = DateTime.fromSeconds(Number(row.Time), { zone: this.timezone })
    if (!time.isValid) {
      return null
    }

    const status = this.diaperStatusLabel(Number(row.Status ?? 0))
    const note = row.Note ? String(row.Note) : undefined
    return { id: String(row.ID), time, status, note }
  }

  private diaperStatusLabel(status: number) {
    switch (status) {
      case 2:
        return 'Pee + poo'
      case 1:
        return 'Poo'
      default:
        return 'Pee'
    }
  }

  private mapMedicine(row: any, meds: Map<string, string>): MedicineEntry | null {
    if (!row.ID || !row.Time) {
      return null
    }
    const time = DateTime.fromSeconds(Number(row.Time), { zone: this.timezone })
    if (!time.isValid) {
      return null
    }
    const medId = row.MedID ? String(row.MedID) : ''
    const name = meds.get(medId) ?? 'Médicament'
    const amount = row.Amount ? Number(row.Amount) : undefined
    const note = row.Note ? String(row.Note) : undefined
    return { id: String(row.ID), time, name, amount, note }
  }

  private getOrCreateBucket(map: Map<string, DailyAggregate>, date: string) {
    if (!map.has(date)) {
      map.set(date, { date, sleepEntries: [], diaperEntries: [], medicineEntries: [] })
    }
    return map.get(date)!
  }

  private async applyAggregate(aggregate: DailyAggregate) {
    let log = await this.dailyLogModel.findOne({ date: aggregate.date })
    const newlyInserted = [] as Array<{ source: string; sourceId: string }>
    let skipped = 0

    if (!log) {
      log = await this.dailyLogModel.create({
        date: aggregate.date,
        mood: 'calme',
        energyLevel: 5,
        meals: {
          breakfast: 'Non renseigné (import BTBK)',
          lunch: 'Non renseigné (import BTBK)',
          snack: 'Non renseigné (import BTBK)',
          dinner: 'Non renseigné (import BTBK)',
        },
        sleep: { naps: 0, totalHours: 0, nightHours: 0, napHours: 0, nightWakings: 0 },
        hygiene: { diapers: 0, baths: 0, medications: '' },
        activities: [],
        notes: 'Import automatique Baby Tracker',
      })
    } else {
      log.sleep.nightHours ??= 0
      log.sleep.napHours ??= 0
      log.sleep.totalHours ??= 0
      log.sleep.naps ??= 0
      log.sleep.nightWakings ??= 0
    }

    const newSleep = await this.appendSleepEntries(log, aggregate.sleepEntries, newlyInserted)
    const newDiapers = await this.appendDiapers(log, aggregate.diaperEntries, newlyInserted)
    const newMeds = await this.appendMedicines(log, aggregate.medicineEntries, newlyInserted)

    skipped =
      aggregate.sleepEntries.length +
      aggregate.diaperEntries.length +
      aggregate.medicineEntries.length -
      newlyInserted.length

    const convertMinutesToHours = (minutes: number) => Math.round(minutes / 60)
    log.sleep.nightHours += convertMinutesToHours(newSleep.nightMinutes)
    log.sleep.napHours += convertMinutesToHours(newSleep.napMinutes)
    log.sleep.totalHours = log.sleep.nightHours + log.sleep.napHours
    log.sleep.naps += newSleep.napCount
    log.sleep.nightWakings += newSleep.nightCount
    log.hygiene.diapers += newDiapers
    log.hygiene.medications = this.appendMedicationNotes(log.hygiene.medications, newMeds.notes)

    log.markModified('sleep')
    log.markModified('hygiene')
    log.markModified('activities')

    await log.save()

    if (newlyInserted.length > 0) {
      await this.importModel.insertMany(
        newlyInserted.map((item) => ({
          source: item.source,
          sourceId: item.sourceId,
          date: aggregate.date,
          logId: log!._id as Types.ObjectId,
        })),
        { ordered: false },
      )
    }

    return { newEntries: newlyInserted.length, skipped }
  }

  private async appendSleepEntries(
    log: DailyLogDocument,
    entries: SleepEntry[],
    inserted: Array<{ source: string; sourceId: string }>,
  ) {
    let nightMinutes = 0
    let napMinutes = 0
    let napCount = 0
    let nightCount = 0
    for (const entry of entries) {
      if (await this.isAlreadyImported('btbk_sleep', entry.id)) {
        continue
      }
      if (entry.type === 'night') {
        nightMinutes += entry.durationMinutes
        nightCount += 1
      } else {
        napMinutes += entry.durationMinutes
        napCount += 1
      }
      inserted.push({ source: 'btbk_sleep', sourceId: entry.id })
    }
    return { nightMinutes, napMinutes, napCount, nightCount }
  }

  private async appendDiapers(
    log: DailyLogDocument,
    entries: DiaperEntry[],
    inserted: Array<{ source: string; sourceId: string }>,
  ) {
    let added = 0
    for (const entry of entries) {
      if (await this.isAlreadyImported('btbk_diaper', entry.id)) {
        continue
      }
      added += 1
      inserted.push({ source: 'btbk_diaper', sourceId: entry.id })
    }
    return added
  }

  private async appendMedicines(
    log: DailyLogDocument,
    entries: MedicineEntry[],
    inserted: Array<{ source: string; sourceId: string }>,
  ) {
    const notes: string[] = []
    for (const entry of entries) {
      if (await this.isAlreadyImported('btbk_medicine', entry.id)) {
        continue
      }
      notes.push(
        `${entry.time.toFormat('HH:mm')} · ${entry.name}${entry.amount ? ` (${entry.amount})` : ''}${
          entry.note ? ` · ${entry.note}` : ''
        }`,
      )
      inserted.push({ source: 'btbk_medicine', sourceId: entry.id })
    }
    return { notes }
  }

  private appendMedicationNotes(current: string, newNotes: string[]) {
    if (!newNotes.length) {
      return current
    }
    const prefix = current?.trim().length ? `${current.trim()}\n` : ''
    return `${prefix}${newNotes.join('\n')}`
  }

  private async isAlreadyImported(source: string, sourceId: string) {
    const existing = await this.importModel.exists({ source, sourceId })
    return Boolean(existing)
  }
}
