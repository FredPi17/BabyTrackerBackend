import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ConnectDropboxDto } from './dto/connect-dropbox.dto'
import { BABY_TRACKER_DROPBOX_BACKUPS } from './samples/dropbox-baby-tracker-backups'
import { randomUUID } from 'node:crypto'
import type { DropboxAuthProvider } from './dto/start-dropbox-oauth.dto'

export interface IntegrationAppSummary {
  id: string
  name: string
  provider: 'dropbox'
  description: string
  status: 'beta' | 'ready'
  requiresTwoFactor: boolean
  documentationUrl?: string
}

export interface DropboxBackupInfo {
  id: string
  fileName: string
  sizeLabel: string
  sizeInBytes: number
  lastModified: string
  note: string
  pathLower: string
}

export interface DropboxConnectionResult {
  status: 'connected'
  appId: string
  appName: string
  accountEmail?: string
  provider?: DropboxAuthProvider
  state?: string
  availableBackups: DropboxBackupInfo[]
  message: string
}

interface DropboxAuthSession {
  state: string
  provider: DropboxAuthProvider
  createdAt: number
}

interface DropboxOAuthConnection {
  state: string
  provider: DropboxAuthProvider
  accountEmail?: string
  accountName?: string
  accountId?: string
  accessToken: string
  refreshToken?: string
  tokenType: string
  expiresAt: number | null
  linkedAt: number
}

interface DropboxTokenResponse {
  access_token: string
  token_type: string
  account_id: string
  uid?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}

interface DropboxAccountResponse {
  email?: string
  name?: {
    display_name?: string
  }
  account_id?: string
}

@Injectable()
export class IntegrationsService {
  private readonly dropboxAppKey: string | undefined
  private readonly dropboxAppSecret: string | undefined
  private readonly dropboxRedirectUri: string | undefined
  private readonly dropboxScopes = ['files.metadata.read', 'files.content.read']
  private readonly dropboxBackupsFolder: string

  private readonly oauthSessions = new Map<string, DropboxAuthSession>()
  private readonly oauthConnections = new Map<string, DropboxOAuthConnection>()

  constructor(private readonly config: ConfigService) {
    this.dropboxAppKey = this.config.get<string>('DROPBOX_APP_KEY')
    this.dropboxAppSecret = this.config.get<string>('DROPBOX_APP_SECRET')
    this.dropboxRedirectUri = this.config.get<string>('DROPBOX_REDIRECT_URI')
    this.dropboxBackupsFolder = this.normalizeDropboxPath(
      this.config.get<string>('DROPBOX_BACKUPS_PATH', '/Applications/BabyTracker/backups'),
    )
  }

  private readonly supportedApps: IntegrationAppSummary[] = [
    {
      id: 'baby-tracker',
      name: 'Baby Tracker',
      provider: 'dropbox',
      description: 'Importez les backups Baby Tracker exportés automatiquement vers Dropbox.',
      status: 'beta',
      requiresTwoFactor: false,
      documentationUrl: 'https://help.dropbox.com/fr-fr/create-upload/third-party-apps',
    },
  ]

  listApps(): IntegrationAppSummary[] {
    return this.supportedApps
  }

  createDropboxAuthSession(provider: DropboxAuthProvider = 'google') {
    this.ensureDropboxConfig()
    const state = randomUUID()
    const session: DropboxAuthSession = {
      state,
      provider,
      createdAt: Date.now(),
    }
    this.oauthSessions.set(state, session)

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.dropboxAppKey!,
      redirect_uri: this.dropboxRedirectUri!,
      state,
      token_access_type: 'offline',
      scope: this.dropboxScopes.join(' '),
      force_reapprove: 'false',
    })

    return {
      state,
      authUrl: `https://www.dropbox.com/oauth2/authorize?${params.toString()}`,
    }
  }

  async finalizeDropboxOAuth(code: string, state: string) {
    this.ensureDropboxConfig()
    const session = this.oauthSessions.get(state)
    if (!session) {
      throw new BadRequestException('Session OAuth Dropbox expirée ou invalide.')
    }
    this.oauthSessions.delete(state)

    const token = await this.exchangeDropboxCode(code)
    const account = await this.fetchDropboxAccount(token.access_token)

    const connection: DropboxOAuthConnection = {
      state,
      provider: session.provider,
      accountEmail: account?.email,
      accountName: account?.name?.display_name,
      accountId: account?.account_id ?? token.account_id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenType: token.token_type,
      expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : null,
      linkedAt: Date.now(),
    }

    this.oauthConnections.set(state, connection)
    return connection
  }

  async getDropboxConnection(state: string): Promise<DropboxConnectionResult> {
    const connection = this.oauthConnections.get(state)
    if (!connection) {
      throw new NotFoundException('Connexion Dropbox introuvable pour cet identifiant.')
    }

    try {
      const backups = await this.loadDropboxBackups(connection.accessToken)
      const message =
        backups.length > 0
          ? `Trouvé ${backups.length} fichier(s) dans ${this.dropboxBackupsFolder}.`
          : `Aucun fichier trouvé dans ${this.dropboxBackupsFolder}.`
    return this.buildConnectionResult(connection.accountEmail, connection.provider, connection.state, backups, message)
    } catch (error) {
      console.warn('Impossible de récupérer la liste des backups Dropbox', error)
      return this.buildConnectionResult(
        connection.accountEmail,
        connection.provider,
        connection.state,
        [],
        'Connexion Dropbox valide mais aucun fichier n’a pu être listé.',
      )
    }
  }

  async connectToDropbox(dto: ConnectDropboxDto): Promise<DropboxConnectionResult> {
    const app = this.supportedApps.find((item) => item.id === dto.appId)
    if (!app) {
      throw new BadRequestException(`L’application « ${dto.appId} » n’est pas encore supportée.`)
    }

    this.ensureTokenLooksValid(dto.accessToken)

    try {
      const backups = await this.loadDropboxBackups(dto.accessToken)
      const message =
        backups.length > 0
          ? `Trouvé ${backups.length} fichier(s) dans ${this.dropboxBackupsFolder}.`
          : `Aucun fichier trouvé dans ${this.dropboxBackupsFolder}.`
      return this.buildConnectionResult(dto.accountEmail, 'email', undefined, backups, message)
    } catch (error) {
      console.warn('Impossible de lister les fichiers Dropbox avec le token fourni', error)
      return this.buildConnectionResult(
        dto.accountEmail,
        'email',
        undefined,
        [],
        'Connexion Dropbox valide mais aucun fichier n’a pu être listé (token insuffisant ou dossier introuvable).',
      )
    }
  }

  async downloadDropboxFile(state: string, path: string) {
    const connection = this.oauthConnections.get(state)
    if (!connection) {
      throw new BadRequestException('Session Dropbox introuvable ou expirée.')
    }
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: normalizedPath }),
      },
    })
    if (!response.ok) {
      const text = await response.text()
      throw new UnauthorizedException(`Impossible de télécharger le fichier Dropbox (${response.status}): ${text}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  private ensureTokenLooksValid(token: string) {
    if (!token || token.length < 20) {
      throw new UnauthorizedException('Token Dropbox invalide. Merci de générer un accès OAuth 2 valide.')
    }
  }

  private ensureDropboxConfig() {
    if (!this.dropboxAppKey || !this.dropboxAppSecret || !this.dropboxRedirectUri) {
      throw new BadRequestException(
        'Dropbox OAuth n’est pas configuré. Merci de définir DROPBOX_APP_KEY, DROPBOX_APP_SECRET et DROPBOX_REDIRECT_URI.',
      )
    }
  }

  private buildConnectionResult(
    accountEmail?: string,
    provider: DropboxAuthProvider = 'email',
    state?: string,
    backups: DropboxBackupInfo[] = BABY_TRACKER_DROPBOX_BACKUPS,
    message = 'Connexion à Dropbox réussie. Téléchargement automatisé à implémenter via l’API officielle /files dans un prochain sprint.',
  ) {
    const app = this.supportedApps[0]
    return {
      status: 'connected' as const,
      appId: app.id,
      appName: app.name,
      accountEmail,
      provider,
      state,
      availableBackups: backups,
      message,
    }
  }

  private async exchangeDropboxCode(code: string) {
    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.dropboxRedirectUri!,
    })

    const authHeader = Buffer.from(`${this.dropboxAppKey}:${this.dropboxAppSecret}`).toString('base64')

    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`,
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new UnauthorizedException(`Impossible d’échanger le code Dropbox (${response.status}): ${errorText}`)
    }

    return (await response.json()) as DropboxTokenResponse
  }

  private async fetchDropboxAccount(accessToken: string): Promise<DropboxAccountResponse | null> {
    try {
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: 'null',
      })

      if (!response.ok) {
        return null
      }

      return (await response.json()) as DropboxAccountResponse
    } catch (err) {
      console.warn('Impossible de récupérer les informations du compte Dropbox', err)
      return null
    }
  }

  private async loadDropboxBackups(accessToken: string): Promise<DropboxBackupInfo[]> {
    const backups: DropboxBackupInfo[] = []
    let cursor: string | null = null
    do {
      const isContinue = Boolean(cursor)
      const url = isContinue
        ? 'https://api.dropboxapi.com/2/files/list_folder/continue'
        : 'https://api.dropboxapi.com/2/files/list_folder'
      const body = isContinue
        ? JSON.stringify({ cursor })
        : JSON.stringify({
            path: this.dropboxBackupsFolder,
            recursive: false,
            include_media_info: false,
            include_deleted: false,
            include_has_explicit_shared_members: false,
            include_mounted_folders: true,
            limit: 2000,
          })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body,
      })

      if (!response.ok) {
        const errorPayload = await response.text()
        throw new Error(`Dropbox API error (${response.status}): ${errorPayload}`)
      }

      const payload = (await response.json()) as {
        entries: Array<{
          '.tag': string
          id?: string
          name: string
          path_lower?: string
          path_display?: string
          size?: number
          client_modified?: string
          server_modified?: string
        }>
        cursor?: string
        has_more?: boolean
      }

      for (const entry of payload.entries) {
        if (entry['.tag'] !== 'file') {
          continue
        }

        const size = entry.size ?? 0
        backups.push({
          id: entry.id ?? entry.path_lower ?? entry.name,
          fileName: entry.name,
          sizeLabel: this.formatFileSize(size),
          sizeInBytes: size,
          lastModified: entry.client_modified ?? entry.server_modified ?? new Date().toISOString(),
          note: entry.path_display ?? '',
          pathLower: entry.path_lower ?? entry.path_display ?? `/${entry.name}`,
        })
      }

      cursor = payload.has_more ? payload.cursor ?? null : null
    } while (cursor)

    return backups
  }

  private formatFileSize(bytes: number) {
    if (bytes <= 0) {
      return '0 octet'
    }
    const units = ['octets', 'Ko', 'Mo', 'Go', 'To']
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / Math.pow(1024, exponent)
    return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
  }

  private normalizeDropboxPath(path: string) {
    if (!path) {
      return '/Application/BabyTracker/backups'
    }
    return path.startsWith('/') ? path.replace(/\/+$/, '') : `/${path.replace(/\/+$/, '')}`
  }

  private async simulateNetworkLatency() {
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
}
