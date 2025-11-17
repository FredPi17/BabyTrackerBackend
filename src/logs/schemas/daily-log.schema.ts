import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import type {
  ActivityLog,
  EvendolAssessment,
  EvendolCriteriaScores,
  HygieneStats,
  MealPlan,
  Mood,
  SleepStats,
} from '../types/daily-log.types'
import { MOOD_VALUES } from '../types/daily-log.types'

@Schema({
  collection: 'daily_logs',
  timestamps: true,
  versionKey: false,
})
export class DailyLog {
  @Prop({ required: true })
  date!: string

  @Prop({ type: String, required: true, enum: MOOD_VALUES })
  mood!: Mood

  @Prop({ type: Number, required: true, min: 1, max: 10 })
  energyLevel!: number

  @Prop({ type: Object, required: true })
  meals!: MealPlan

  @Prop({ type: Object, required: true })
  sleep!: SleepStats

  @Prop({ type: Object, required: true })
  hygiene!: HygieneStats

  @Prop({
    type: [
      {
        time: { type: String, required: true },
        description: { type: String, required: true },
      },
    ],
    required: true,
    _id: false,
  })
  activities!: ActivityLog[]

  @Prop({ required: false, default: '' })
  notes!: string

  @Prop({
    type: [
      {
        recordedAt: { type: String, required: true },
        comment: { type: String },
        totalScore: { type: Number, min: 0, max: 15, required: true },
        criteria: {
          vocal: { type: Number, min: 0, max: 3, required: true },
          mimic: { type: Number, min: 0, max: 3, required: true },
          movements: { type: Number, min: 0, max: 3, required: true },
          positions: { type: Number, min: 0, max: 3, required: true },
          relation: { type: Number, min: 0, max: 3, required: true },
        },
        _id: false,
      },
    ],
    default: [],
  })
  evendolAssessments!: EvendolAssessment[]

  @Prop()
  createdAt?: Date

  @Prop()
  updatedAt?: Date
}

export type DailyLogDocument = HydratedDocument<DailyLog>
export const DailyLogSchema = SchemaFactory.createForClass(DailyLog)

DailyLogSchema.index({ date: -1, createdAt: -1 })
DailyLogSchema.virtual('id').get(function (this: DailyLogDocument) {
  return this._id.toString()
})

DailyLogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret: any) => {
    delete ret._id
  },
})

DailyLogSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret: any) => {
    delete ret._id
  },
})
