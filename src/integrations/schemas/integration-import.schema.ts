import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, SchemaTypes, Types } from 'mongoose'

@Schema({ collection: 'integration_imports', timestamps: true, versionKey: false })
export class IntegrationImport {
  @Prop({ required: true })
  source!: string

  @Prop({ required: true })
  sourceId!: string

  @Prop({ required: true })
  date!: string

  @Prop({ type: SchemaTypes.ObjectId, ref: 'DailyLog' })
  logId?: Types.ObjectId
}

export type IntegrationImportDocument = HydratedDocument<IntegrationImport>
export const IntegrationImportSchema = SchemaFactory.createForClass(IntegrationImport)
IntegrationImportSchema.index({ source: 1, sourceId: 1 }, { unique: true })
