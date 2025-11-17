import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)
  const originConfig = config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173')
  const allowedOrigins = originConfig
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (allowedOrigins.length === 0) {
    allowedOrigins.push('http://localhost:5173')
  }

  const corsOptions: CorsOptions = {
    credentials: true,
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  }

  const port = config.get<number>('PORT', 3000)

  app.setGlobalPrefix('api')
  app.enableCors(corsOptions)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  await app.listen(port)
  console.log(`🚀 API Evendol démarrée sur http://localhost:${port}`)
}
bootstrap()
