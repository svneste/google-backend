import { Injectable } from '@nestjs/common';
import { authenticate } from '@google-cloud/local-auth';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { InjectRepository } from '@nestjs/typeorm';
import { Calendar } from './calendar.entity';
import { Repository } from 'typeorm';
const path = require('node:path');
const fs = require('fs').promises;

@Injectable()
export class CalendarService {
  constructor(
    private config: ConfigService,
    @InjectRepository(Calendar)
    private calendarRepo: Repository<Calendar>,
  ) {}

  // Обрабатываем ответ от Google который приходит при авторизации пользователя

  async performCallback() {
    console.log('сработало')
    let client = await this.loadSavedCredentialsIfExist();
    if (client) {
      return client;
    }

    client = await authenticate({
      scopes: this.SCOPES,
      keyfilePath: this.CREDENTIALS_PATH,
    });

    if (client.credentials) {
      await this.saveCredentials(client);
    }

    return client;

    // const googleAccount = await this.calendarRepo.create({
    //   clientId: 736736,
    //   oauth: {
    //     accessToken: client.credentials.access_token,
    //     refreshToken: client.credentials.refresh_token,
    //     expire: client.credentials.expiry_date,
    //   },
    // });

    // await this.calendarRepo.save(googleAccount);
  }

  // Функция которая проверяет существующие данные и если данные есть проводит авторизацию

  async loadSavedCredentialsIfExist(): Promise<any> {
    try {
      const content = await fs.readFile(this.TOKEN_PATH);
      const credentials = JSON.parse(content);
      return google.auth.fromJSON(credentials);
    } catch (err) {
      return null;
    }
  }

  // Функция которая будет сохранять данные в базу

  async saveCredentials(client) {
    const content = await fs.readFile(this.CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(this.TOKEN_PATH, payload);
  }

  SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ];
  TOKEN_PATH = path.join(process.cwd(), 'token.json');
  CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
  refresh_token = '';

  googleCredentials = {
    client_id: this.config.get('GOOGLE_CLIENT_ID'),
    project_id: this.config.get('GOOGLE_PROJECT_ID'),
    auth_uri: this.config.get('GOOGLE_AUTH_URI'),
    token_uri: this.config.get('GOOGLE_TOKEN_URI'),
    auth_provider_x509_cert_url: this.config.get(
      'GOOGLE_PROVIDER_X509_CERT_URL',
    ),
    client_secret: this.config.get('GOOGLE_CLIENT_SECRET'),
  };

  async getCredentials(client) {
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: this.googleCredentials.client_id,
      client_secret: this.googleCredentials.client_secret,
      refresh_token: client.credentials.refresh_token || this.refresh_token,
    });
    this.refresh_token = client.credentials.refresh_token;
    return payload;
  }

  async getEvents(auth) {
    const calendar = google.calendar({ version: 'v3', auth });

    const res = await calendar.events.list({
      calendarId:
        'b99ff8e5b8293cb5bd46d1e3305ba9847dfd8d8e4b81708fabd288f3fe2d9dc3@group.calendar.google.com',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const events = res.data.items;
    if (!events || events.length === 0) {
      console.log('No upcoming events found.');

      return;
    }
    console.log('Upcoming 10 events:');
    return events.map((event, i) => {
      const start = event.start.dateTime || event.start.date;
      return `${start} - ${event.summary}`;
    });
  }

  async getCalendarData(data) {
    return data
  }

  async insertEvent(data) {
    let auth = await this.performCallback();
    let nameLocationList;
    let nameLocation;
    let dateStart;
    let dateEnd;
    const calendar = google.calendar({ version: 'v3', auth });

    data.data.custom_fields_values.map((a) => {
      if (a.field_id === 2626323) {
        nameLocationList = a.values
        nameLocationList.map((a) => (nameLocation = a.value))
      }

      if (a.field_id === 2626327) {
        a.values.map((a) => (dateStart = a.value))
      }

      if (a.field_id === 2626329) {
        a.values.map((a) => (dateEnd = a.value))
      }
    })
    let dateStartForGoogle = new Date(dateStart * 1000);
    let dateEndForGoogle = new Date(dateEnd * 1000);

    calendar.events.insert({
      auth: auth,
      calendarId:
        'b99ff8e5b8293cb5bd46d1e3305ba9847dfd8d8e4b81708fabd288f3fe2d9dc3@group.calendar.google.com',
      requestBody: {
        summary: `${data.data.name} / ${nameLocation}`,
        location: nameLocation,
        start: {
          dateTime: dateStartForGoogle.toISOString(),
          timeZone: 'Europe/Moscow',
        },
        end: {
          dateTime: dateEndForGoogle.toISOString(),
          timeZone: 'Europe/Moscow',
        },
      },
    }, (err, event) => {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err); return;
      }
      console.log('Event created: %s', event.htmlLink)
    }
    );
  }
}
