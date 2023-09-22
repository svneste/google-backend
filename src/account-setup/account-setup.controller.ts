import { All, Controller, Get, Query, Redirect } from '@nestjs/common';
import { AccountSetupService } from './account-setup.service';

@Controller('auth')
export class AccountSetupController {
  constructor(private accountService: AccountSetupService) {}

  @Get('login')
  @Redirect()
  login() {
    const authUrl = this.accountService.getAuthUrl();
    console.log(authUrl)
    return { url: authUrl };
  }

  @Get('account-setup/oauth2callback')
  async callback(@Query('code') code: string) {
    console.log('запустили то что нужно')
    const tokens = await this.accountService.getAccessToken(code);
    const oauthClient = this.accountService.getOAuthClient(tokens);

    console.log(oauthClient)
  }
}
