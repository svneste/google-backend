import { Controller, Redirect, Get, Query } from '@nestjs/common';
import { GoogleService } from './google.service';

@Controller('google')
export class GoogleController {
  constructor(private googleService: GoogleService) {}

  @Get('login')
  @Redirect()
  login() {
    const authUrl = this.googleService.getAuthUrl();
    return { url: authUrl };
  }

  @Get('oauth2callback')
  async callback(@Query('code') code: string) {
    const tokens = await this.googleService.getAccessToken(code);
    this.googleService.saveTokensForGoogle(tokens);
  }
}
