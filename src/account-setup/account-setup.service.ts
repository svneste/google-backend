import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccountSetup } from './account-setup.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
const fs = require('fs').promises;
const path = require('node:path');

@Injectable()
export class AccountSetupService {
  private readonly authClient;

  constructor() {
    this.authClient = new google.auth.OAuth2(
      '823846756849-3ov5ire1f75ta50v8q6csgcra2dg84ar.apps.googleusercontent.com',
      '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',
      'https://764e-94-29-14-210.ngrok-free.app/account-setup/oauth2callback',
    );
  }

  CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ];
    console.log('запустили getAuthUrl')

    return this.authClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
  }

  async getAccessToken(code: string) {
    console.log('запущен getAccessToken')
    const { tokens } = await this.authClient.getToken(code);
    return tokens;
  }

  getOAuthClient(tokens) {
    this.authClient.setCredentials(tokens);
    return this.authClient;
  }
}
