import { IsString } from 'class-validator'

export class ImportDropboxFileDto {
  @IsString()
  state!: string

  @IsString()
  path!: string
}
