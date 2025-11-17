import { IsOptional, IsString, MinLength } from 'class-validator'

export class ConnectDropboxDto {
  @IsString()
  appId: string

  @IsOptional()
  @IsString()
  accountEmail?: string

  @IsString()
  @MinLength(20)
  accessToken: string
}
