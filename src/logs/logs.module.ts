import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { LogsController } from './logs.controller'
import { LogsService } from './logs.service'
import { DailyLog, DailyLogSchema } from './schemas/daily-log.schema'

@Module({
  imports: [MongooseModule.forFeature([{ name: DailyLog.name, schema: DailyLogSchema }])],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
