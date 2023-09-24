import { All, Body, Controller, Get, Query, Redirect } from '@nestjs/common';
import { AccountSetupService } from './account-setup.service';

@Controller('auth2')
export class AccountSetupController {
  constructor(private accountService: AccountSetupService) {}

  @Get('login')
  @Redirect()
  login() {
    const authUrl = this.accountService.getAuthUrl();
    console.log(authUrl);
    return { url: authUrl };
  }

  @Get('account-setup/oauth2callback')
  async callback(@Query('code') code: string) {
    const tokens = await this.accountService.getAccessToken(code);
    const oauthClient = this.accountService.getOAuthClient(tokens);
    const accessToken = tokens.access_token;
    
    this.accountService.saveTokensForGoogle(tokens);
  }

  @All('web')
  async request (@Body() body: any) {
    let leadId;
    body.leads.status.map((a) => (leadId = a.id));
    
    const response = await this.accountService.createEvent();
  }
}
