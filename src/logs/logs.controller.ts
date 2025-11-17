import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { CreateDailyLogDto } from './dto/create-daily-log.dto'
import { UpdateDailyLogDto } from './dto/update-daily-log.dto'
import { LogsService } from './logs.service'

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  findAll() {
    return this.logsService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.logsService.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateDailyLogDto) {
    return this.logsService.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDailyLogDto) {
    return this.logsService.update(id, dto)
  }
}
