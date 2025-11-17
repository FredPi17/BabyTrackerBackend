export const MOOD_VALUES = ['joyeux', 'calme', 'excité', 'fatigué', 'grognon'] as const
export type Mood = (typeof MOOD_VALUES)[number]

export interface MealPlan {
  breakfast: string
  lunch: string
  snack: string
  dinner: string
}

export interface SleepStats {
  naps: number
  totalHours: number
  nightHours: number
  napHours: number
  nightWakings: number
}

export interface HygieneStats {
  diapers: number
  baths: number
  medications: string
}

export interface ActivityLog {
  time: string
  description: string
}

export const EVENDOL_CRITERIA = {
  vocal: 'Expression vocale / verbale',
  mimic: 'Mimique',
  movements: 'Mouvements',
  positions: 'Positions',
  relation: "Relation avec l'environnement",
} as const

export type EvendolCriterionKey = keyof typeof EVENDOL_CRITERIA

export interface EvendolCriteriaScores {
  vocal: number
  mimic: number
  movements: number
  positions: number
  relation: number
}

export interface EvendolAssessment {
  recordedAt: string
  comment?: string
  criteria: EvendolCriteriaScores
  totalScore: number
}
