import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Google } from './google.entity';
import { Repository } from 'typeorm';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { OAuthField } from 'src/interfaces/oauth-field.interface';

@Injectable()
export class GoogleService {
  private readonly authClient;
  private calendar;

  constructor(
    @InjectRepository(Google) private googleRepo: Repository<Google>,
    private config: ConfigService,
  ) {
    this.authClient = new google.auth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
      this.config.get('GOOGLE_REDIRECT_URI'),
    );
  }

  async authorized(amoId) {
    // обращаемся к базе чтобы получить refresh с ним формируем auth клиента и возвращаем этого клиента скрипту который его запросил

    const client = await this.googleRepo.findOne({
      where: {
        amoId,
      },
    });

    console.log(client.oauth.refreshToken)

    this.authClient.credentials.refresh_token = client.oauth.refreshToken;
    return this.authClient;

    

    // const calendar = google.calendar({ version: 'v3', auth: this.authClient });
    // console.log(calendar, 'calendar');
  }

  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.authClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
  }

  async getAccessToken(code: string) {
    const { tokens } = await this.authClient.getToken(code);
    return tokens;
  }

  getOAuthClient(tokens) {
    this.authClient.setCredentials(tokens);
    return this.authClient;
  }

  async saveTokensForGoogle(tokens) {
    const oauth: OAuthField = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expire: tokens.expiry_date,
    };

    try {
      await this.googleRepo.save({
        amoId: 30062854,
        domain: 'eventmoskvaa.amocrm.ru',
        oauth,
      });
    } catch (error) {
      console.log(`Не удалось сохоанить данные в базу данных - ${error}`);
    }
  }
}
