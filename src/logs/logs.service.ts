import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { CreateDailyLogDto } from './dto/create-daily-log.dto'
import { UpdateDailyLogDto } from './dto/update-daily-log.dto'
import { DailyLog, DailyLogDocument } from './schemas/daily-log.schema'
import type { ActivityLog, EvendolCriteriaScores } from './types/daily-log.types'

@Injectable()
export class LogsService {
  constructor(@InjectModel(DailyLog.name) private readonly model: Model<DailyLogDocument>) {}

  findAll() {
    return this.model.find().sort({ date: -1, createdAt: -1 }).exec()
  }

  async findOne(id: string) {
    const entity = await this.model.findById(id).exec()
    if (!entity) {
      throw new NotFoundException(`Suivi ${id} introuvable`)
    }

    return entity
  }

  async create(dto: CreateDailyLogDto) {
    const entity = new this.model({
      ...dto,
      notes: dto.notes?.trim() ?? '',
      activities: this.normalizeActivities(dto.activities),
      evendolAssessments: this.normalizeAssessments(dto.evendolAssessments),
    })
    return entity.save()
  }

  async update(id: string, dto: UpdateDailyLogDto) {
    const payload: UpdateDailyLogDto & { evendolAssessments?: CreateDailyLogDto['evendolAssessments'] } = {
      ...dto,
    }

    if (dto.activities) {
      payload.activities = this.normalizeActivities(dto.activities)
    }

    if (typeof dto.notes === 'string') {
      payload.notes = dto.notes.trim()
    }

    if (dto.evendolAssessments) {
      payload.evendolAssessments = this.normalizeAssessments(dto.evendolAssessments)
    }

    const updated = await this.model
      .findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      })
      .exec()

    if (!updated) {
      throw new NotFoundException(`Suivi ${id} introuvable`)
    }

    return updated
  }

  private normalizeActivities(activities?: ActivityLog[]) {
    if (!activities || activities.length === 0) {
      throw new BadRequestException('Merci de renseigner au moins une activité (description obligatoire).')
    }

    const cleaned = activities
      .map((activity) => ({
        time: activity.time,
        description: activity.description?.trim() ?? '',
      }))
      .filter((activity) => activity.description.length > 0)

    if (cleaned.length === 0) {
      throw new BadRequestException('Merci de renseigner au moins une activité (description obligatoire).')
    }

    return cleaned
  }

  private normalizeAssessments(assessments?: CreateDailyLogDto['evendolAssessments']) {
    if (!assessments || assessments.length === 0) {
      return []
    }

    return assessments.map((assessment) => {
      const criteria = assessment.criteria ?? this.emptyCriteria()
      return {
        recordedAt: assessment.recordedAt,
        comment: assessment.comment,
        criteria,
        totalScore: this.computeTotalScore(criteria),
      }
    })
  }

  private emptyCriteria(): EvendolCriteriaScores {
    return {
      vocal: 0,
      mimic: 0,
      movements: 0,
      positions: 0,
      relation: 0,
    }
  }

  private computeTotalScore(criteria: EvendolCriteriaScores) {
    return Object.values(criteria).reduce((acc, value) => acc + value, 0)
  }
}
