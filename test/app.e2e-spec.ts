import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const samplePayload = {
  date: new Date().toISOString().split('T')[0],
  mood: 'joyeux',
  energyLevel: 7,
  meals: {
    breakfast: 'Porridge',
    lunch: 'Poulet et riz',
    snack: 'Compote',
    dinner: 'Soupe de légumes',
  },
  sleep: {
    naps: 2,
    totalHours: 12,
    nightWakings: 1,
  },
  hygiene: {
    diapers: 4,
    baths: 1,
    medications: 'Vitamine D',
  },
  activities: [
    { time: '09:00', description: 'Jeu libre' },
    { time: '15:00', description: 'Sortie parc' },
  ],
  notes: 'Belle journée dans l\'ensemble.',
  evendolAssessments: [
    {
      recordedAt: '09:00',
      comment: 'Avant le repas',
      criteria: {
        vocal: 1,
        mimic: 1,
        movements: 1,
        positions: 0,
        relation: 1,
      },
      totalScore: 4,
    },
  ],
}

describe('Logs API (e2e)', () => {
  let app: INestApplication
  let mongo: MongoMemoryServer

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    process.env.MONGO_URI = mongo.getUri('evendol-tests')
  })

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    )

    await app.init()
  })

  afterEach(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase()
    }
    await app.close()
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongo.stop()
  })

  it('GET /api/logs should return an empty list initially', async () => {
    const response = await request(app.getHttpServer()).get('/api/logs').expect(200)
    expect(response.body).toEqual([])
  })

  it('POST /api/logs should create a new entry', async () => {
    const response = await request(app.getHttpServer()).post('/api/logs').send(samplePayload).expect(201)

    expect(response.body).toMatchObject({
      id: expect.any(String),
      mood: samplePayload.mood,
      energyLevel: samplePayload.energyLevel,
    })
  })
})
