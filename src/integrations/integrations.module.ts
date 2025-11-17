import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { IntegrationsController } from './integrations.controller'
import { IntegrationsService } from './integrations.service'
import { DropboxImportService } from './dropbox-import.service'
import { IntegrationImport, IntegrationImportSchema } from './schemas/integration-import.schema'
import { DailyLog, DailyLogSchema } from '../logs/schemas/daily-log.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyLog.name, schema: DailyLogSchema },
      { name: IntegrationImport.name, schema: IntegrationImportSchema },
    ]),
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, DropboxImportService],
})
export class IntegrationsModule {}
