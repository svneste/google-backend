import { Injectable, HttpServer } from '@nestjs/common';
import { google } from 'googleapis';
const fs = require('fs').promises;
const path = require('node:path');
import { ConfigService } from '@nestjs/config';
import { OAuthField } from 'src/interfaces/oauth-field.interface';
import { Repository } from 'typeorm';
import { AccountSetup } from './account-setup.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AccountSetupService {
  private readonly authClient;
  private calendar;

  constructor(
    @InjectRepository(AccountSetup)
    private accountSetupRepo: Repository<AccountSetup>,
    private config: ConfigService,
  ) {
    this.authClient = new google.auth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
      this.config.get('GOOGLE_REDIRECT_URI'),
    );
   // this.authClient.credentials.refresh_token = this.authorized(30062854);

  
    
    this.calendar = google.calendar({ version: 'v3', auth: this.authClient });
  }

  CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

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

  // async authorized(amoId) {



  //   return await this.accountSetupRepo.findOne({
  //     where: {
  //       amoId,
  //     }
  //   })
  // }

  async makeAuthenticatedRequest(
    url: string,
    method: string,
    accessToken: string,
    data?: any,
  ): Promise<any> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    // const response = await this.httpService
    //   .request({
    //     url,
    //     method,
    //     headers,
    //     data,
    //   })
    //   .toPromise();

    // return response.data;
  }


  async saveTokensForGoogle(tokens) {
    const oauth: OAuthField = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expire: tokens.expiry_date,
    };

    try {
      await this.accountSetupRepo.save({
        amoId: 30062854,
        domain: 'eventmoskvaa.amocrm.ru',
        oauth,
      })
    } catch (error){
      console.log(`Не удалось сохоанить данные в базу данных - ${error}`)
    }
  }

  async createEvent() {
    
    try {
      const response = await this.calendar.events.insert({
        auth: this.authClient,
        calendarId:
          'b99ff8e5b8293cb5bd46d1e3305ba9847dfd8d8e4b81708fabd288f3fe2d9dc3@group.calendar.google.com',
        requestBody: {
          summary: 'Проверка',
          description: 'Комментарий',
          start: {
            dateTime: new Date().toISOString(),
            timeZone: 'Europe/Moscow',
          },
          end: {
            dateTime: new Date().toISOString(),
            timeZone: 'Europe/Moscow',
          },
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create event: ${error.message}`);
    }
  }
}
