import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
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

class MealPlanDto implements MealPlan {
  @IsString()
  breakfast!: string

  @IsString()
  lunch!: string

  @IsString()
  snack!: string

  @IsString()
  dinner!: string
}

class SleepStatsDto implements SleepStats {
  @IsInt()
  @Min(0)
  naps!: number

  @IsInt()
  @Min(0)
  totalHours!: number

  @IsInt()
  @Min(0)
  nightHours!: number

  @IsInt()
  @Min(0)
  napHours!: number

  @IsInt()
  @Min(0)
  nightWakings!: number
}

class HygieneStatsDto implements HygieneStats {
  @IsInt()
  @Min(0)
  diapers!: number

  @IsInt()
  @Min(0)
  baths!: number

  @IsString()
  medications!: string
}

class ActivityLogDto implements ActivityLog {
  @IsString()
  time!: string

  @IsString()
  @IsNotEmpty()
  description!: string
}

class EvendolCriteriaDto implements EvendolCriteriaScores {
  @IsInt()
  @Min(0)
  @Max(3)
  vocal!: number

  @IsInt()
  @Min(0)
  @Max(3)
  mimic!: number

  @IsInt()
  @Min(0)
  @Max(3)
  movements!: number

  @IsInt()
  @Min(0)
  @Max(3)
  positions!: number

  @IsInt()
  @Min(0)
  @Max(3)
  relation!: number
}

class EvendolAssessmentDto implements EvendolAssessment {
  @IsString()
  recordedAt!: string

  @IsOptional()
  @IsString()
  comment?: string

  @ValidateNested()
  @Type(() => EvendolCriteriaDto)
  criteria!: EvendolCriteriaDto

  @IsOptional()
  @IsInt()
  totalScore!: number
}

export class CreateDailyLogDto {
  @IsDateString()
  date!: string

  @IsIn(MOOD_VALUES)
  mood!: Mood

  @IsInt()
  @Min(1)
  @Max(10)
  energyLevel!: number

  @ValidateNested()
  @Type(() => MealPlanDto)
  meals!: MealPlanDto

  @ValidateNested()
  @Type(() => SleepStatsDto)
  sleep!: SleepStatsDto

  @ValidateNested()
  @Type(() => HygieneStatsDto)
  hygiene!: HygieneStatsDto

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ActivityLogDto)
  activities!: ActivityLogDto[]

  @IsOptional()
  @IsString()
  notes?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvendolAssessmentDto)
  @IsOptional()
  evendolAssessments?: EvendolAssessmentDto[]
}
