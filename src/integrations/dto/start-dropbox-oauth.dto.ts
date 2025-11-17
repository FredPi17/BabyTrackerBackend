import { IsIn, IsOptional, IsString } from 'class-validator'

export type DropboxAuthProvider = 'google' | 'apple' | 'email'

export class StartDropboxOauthDto {
  @IsOptional()
  @IsString()
  @IsIn(['google', 'apple', 'email'])
  provider?: DropboxAuthProvider
}
