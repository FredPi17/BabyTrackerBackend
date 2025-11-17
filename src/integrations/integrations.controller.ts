import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common'
import { ConnectDropboxDto } from './dto/connect-dropbox.dto'
import { IntegrationsService } from './integrations.service'
import { StartDropboxOauthDto } from './dto/start-dropbox-oauth.dto'
import type { Response } from 'express'
import { DropboxImportService } from './dropbox-import.service'
import { ImportDropboxFileDto } from './dto/import-dropbox-file.dto'

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly service: IntegrationsService,
    private readonly dropboxImport: DropboxImportService,
  ) {}

  @Get('apps')
  listApps() {
    return this.service.listApps()
  }

  @Post('dropbox/auth-session')
  startDropboxOauth(@Body() dto: StartDropboxOauthDto) {
    return this.service.createDropboxAuthSession(dto.provider ?? 'google')
  }

  @Get('dropbox/connections/:state')
  getDropboxConnection(@Param('state') state: string) {
    return this.service.getDropboxConnection(state)
  }

  @Post('dropbox/connect')
  connectToDropbox(@Body() dto: ConnectDropboxDto) {
    return this.service.connectToDropbox(dto)
  }

  @Post('dropbox/import')
  async importDropboxFile(@Body() dto: ImportDropboxFileDto) {
    const buffer = await this.service.downloadDropboxFile(dto.state, dto.path)
    return this.dropboxImport.importArchive(buffer)
  }

  @Get('dropbox/callback')
  async dropboxCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      const html = this.renderOauthResultPage({
        success: false,
        state: state ?? '',
        message: 'Paramètres Dropbox manquants. Merci de relancer la connexion.',
      })
      return res.status(400).send(html)
    }

    try {
      await this.service.finalizeDropboxOAuth(code, state)
      const html = this.renderOauthResultPage({
        success: true,
        state,
        message: 'Votre compte Dropbox est maintenant lié à Evendol.',
      })
      return res.send(html)
    } catch (error) {
      const html = this.renderOauthResultPage({
        success: false,
        state,
        message: error instanceof Error ? error.message : 'Erreur inconnue lors de la connexion Dropbox.',
      })
      return res.status(400).send(html)
    }
  }

  private renderOauthResultPage(payload: { success: boolean; state: string; message: string }) {
    const cleanedState = payload.state ?? ''
    const serializedMessage = JSON.stringify({
      type: 'DROPBOX_OAUTH_RESULT',
      success: payload.success,
      state: cleanedState,
      message: payload.message,
    })
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')

    const escapedText = payload.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')

    return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Connexion Dropbox</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 2rem; text-align: center; }
      .status { font-weight: 600; color: ${payload.success ? '#16a34a' : '#b91c1c'}; margin-bottom: 0.5rem; }
      p { color: #0f172a; }
    </style>
  </head>
  <body>
    <p class="status">${payload.success ? 'Connexion réussie ✅' : 'Connexion interrompue ⚠️'}</p>
    <p>${escapedText}</p>
    <p>Vous pouvez fermer cette fenêtre.</p>
    <script>
      (function () {
        const payload = ${serializedMessage};
        if (window.opener) {
          window.opener.postMessage(payload, '*');
        }
        setTimeout(function () {
          window.close();
        }, 500);
      })();
    </script>
  </body>
</html>`
  }
}
