import { Injectable } from '@nestjs/common';
import { authenticate } from '@google-cloud/local-auth';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { InjectRepository } from '@nestjs/typeorm';
import { Calendar } from './calendar.entity';
import { Repository } from 'typeorm';
import { OAuth2Client } from 'google-auth-library';
const path = require('node:path');
const fs = require('fs').promises;

@Injectable()
export class CalendarService {
  constructor(
    private config: ConfigService,
    @InjectRepository(Calendar)
    private eventsCalendarRepo: Repository<Calendar>,
  ) {}

  //Первичная авторизация в Google календаре
  async authCalendar() {
    console.log('Запустили скрипт авторизации');
    console.log('this.CREDENTIALS_PATH', this.CREDENTIALS_PATH);
    let client;
    try {
      client = await authenticate({
        scopes: this.SCOPES,
        keyfilePath: this.CREDENTIALS_PATH,
      });
    } catch (err) {
      console.log('Ошибка', err);
    } finally {
      console.log('Отработал finally')
    }

    console.log(client, 'client');

    if (client.credentials) {
      await this.saveCredentials(client);
    } else {
      console.log('ничего нет');
    }
  }



  // Обрабатываем ответ от Google который приходит при авторизации пользователя

  async performCallback() {
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

  async insertEventsByDateBase(events, calendarId, namePlace) {
    let auth = await this.performCallback();
    const calendar = google.calendar({ version: 'v3', auth });

    calendar.events.insert(
      {
        auth: auth,
        calendarId: calendarId,
        requestBody: {
          summary: `${this.config.get(events.statusEvent)} ${
            events.formatEvent
          } / ${events.nameEvent} / ${events.numGuests} гостей`,
          location: `${namePlace}`,
          description: `Ответственный сотрудник в amoCRM: ${this.config.get(
            events.responsible_user,
          )} <br />Ссылка на сделку в <a href="${
            events.leadLink
          }"> amoCRM </a> `,
          start: {
            dateTime: new Date(events.dataStartEvent * 1000).toISOString(),
            timeZone: 'Europe/Moscow',
          },
          end: {
            dateTime: new Date(events.dataEndEvent * 1000).toISOString(),
            timeZone: 'Europe/Moscow',
          },
        },
      },
      (err, event) => {
        if (err) {
          console.log(
            'При добавлении события в календарь возникла ошибка' + err,
          );
          return;
        }
        console.log('Событие успешно добавлено', event.data);
        // после того как событие добавлено необходимо в базу добавить идентификаторы этих оссобытий
        this.updateDateBaseInfoByEvent(events, event.data, namePlace);
      },
    );
  }

  // добавляем в базу идентификаторы событий календаря / обновление данных в базе

  async updateDateBaseInfoByEvent(data, infoByEvent, namePlace) {
    console.log(data.idEvent, 'data.idEvent');
    data.idEvent.push(`${infoByEvent.id}/${namePlace}`);
    this.eventsCalendarRepo.save(data);
  }

  // получаем данные из базы и подготовливаем для передачи в GOOGLE
  async prepareDateForCalendar(idLead) {
    let events = await this.findByEventId(idLead);
    // нужно получить календарь ID чтобы понимать куда добавлять событие
    events.placeEvent.map((a) => {
      let namePlace = a;
      let namePlaceForEnv = a.replace(/\s+/g, '');
      let calendarId = this.config.get(`${namePlaceForEnv}`);
      this.insertEventsByDateBase(events, calendarId, namePlace);
    });
  }

  // Сценарий проверки на этап Нереализовано - если этот этап то распредялть запрос

  async checkRequestByDelete(data) {
    let events = await this.findByEventId(data.idLead);

    if (data.status_id === 143) {
      if (!events) {
        return;
      } else {
        // здесь выполняем поиск события и удаляем его из календаря и базы
        events.idEvent.map((a) => {
          let idEvent = a.split('/')[0];
          let calendarIdName = a.split('/')[1].replace(/\s+/g, '');
          let calendarId = this.config.get(`${calendarIdName}`);
          console.log('Удаляем события из календаря и базы');
          this.deleteEventForCalendar(calendarId, idEvent, events.idLead);
        });
      }
    } else {
      this.insertDateBaseInfoByEvents(data, events);
    }
  }

  // ИЛИ ЗАПИСЫВАЕМ ДАННЫЕ В БАЗУ ИЛИ ЕСЛИ ДАННЫЕ УЖЕ ЕСТЬ ТО ОБНОВЛЯЕМ

  async insertDateBaseInfoByEvents(data, events) {
    // если в базе ничего не найдено нужно сохранить данные в базу и запустить создание события из базы
    if (!events) {
      await this.eventsCalendarRepo.save(data);
      await this.prepareDateForCalendar(data.idLead);
    } else {
      /// Если запись в базе есть - и статус нереализовано нужно найти какие есть события в календаре и удалить из из календаря и убрать из базы

      console.log(events, 'вот это нашли в базе');
      if (events.placeEvent.length !== data.placeEvent.length) {
        // данные по площадкам текущей сделки отличаются - нужно проверять удалять события или добавлять ! Нужно еще проверять вдруг площадка другая хотя количество не менялось
        console.log('Изменилось количество площадок в сделке');
        // events.leadName = data.leadName;
        // events.status_id = data.status_id;
        // events.nameEvent = data.nameEvent;
        // events.numGuests = data.numGuests;
        // events.responsible_user = data.responsible_user;
        // events.dataStartEvent = data.dataStartEvent;
        // events.dataEndEvent = data.dataEndEvent;
        // events.formatEvent = data.formatEvent;
        // events.placeEvent = data.placeEvent;
        // обновдяем данные в базе данных
        // await this.eventsCalendarRepo.save(events);
        // по тем евентам у которых уже есть событие в календаре нужно обновить данные
        console.log(events.placeEvent, data.placeEvent);
        // по тем евентам у которых записи нет нужно запись добавить
        if (events.placeEvent.length < data.placeEvent.length) {
          console.log(
            'добавилась новая площадка нужно по ней создать запись в календаре',
          );

          // сравниваем два массива и находим новые элементы - которые сохраняем в новый массив и для этого массива создаем новые события
          let newPlace = data.placeEvent.filter(
            (item) => !events.placeEvent.includes(item),
          );
          let placeByBase = data.placeEvent.filter((item) =>
            events.placeEvent.includes(item),
          ); // это массив данные в котором нужно обновить

          placeByBase.map((a) => {
            events.leadName = data.leadName;
            events.status_id = data.status_id;
            events.nameEvent = data.nameEvent;
            events.numGuests = data.numGuests;
            events.responsible_user = data.responsible_user;
            events.dataStartEvent = data.dataStartEvent;
            events.dataEndEvent = data.dataEndEvent;
            events.formatEvent = data.formatEvent;
            events.placeEvent = data.placeEvent;
            let calendarId = this.config.get(a.replace(/\s+/g, ''));
            this.eventsCalendarRepo.save(events);
            this.updateEventForCalendarPrepareData(events.idLead);
          });

          newPlace.map((a) => {
            events.leadName = data.leadName;
            events.status_id = data.status_id;
            events.nameEvent = data.nameEvent;
            events.numGuests = data.numGuests;
            events.responsible_user = data.responsible_user;
            events.dataStartEvent = data.dataStartEvent;
            events.dataEndEvent = data.dataEndEvent;
            events.formatEvent = data.formatEvent;
            events.placeEvent = data.placeEvent;
            let calendarId = this.config.get(a.replace(/\s+/g, ''));
            this.insertEventsByDateBase(events, calendarId, a);
          });
        }

        // по тем евентам которых больше нет - нужно запись удалить //события которые остались нужно обновить + обновить информацию по ним в базе данных
        if (events.placeEvent.length > data.placeEvent.length) {
          console.log(
            'Площадок стало меньше нужно убрать лишние события из календаря',
          );
          let deletePlace = events.placeEvent.filter(
            (item) => !data.placeEvent.includes(item),
          );
          let placeByBase = events.placeEvent.filter((item) =>
            data.placeEvent.includes(item),
          );
          let newArrayPlaceForDataBase = [];
          let eventId = events.idEvent;

          placeByBase.map((a) => {
            let placeByBase = a;
            eventId.map((a) => {
              newArrayPlaceForDataBase.push(a);
              events.leadName = data.leadName;
              events.status_id = data.status_id;
              events.nameEvent = data.nameEvent;
              events.numGuests = data.numGuests;
              events.responsible_user = data.responsible_user;
              events.dataStartEvent = data.dataStartEvent;
              events.dataEndEvent = data.dataEndEvent;
              events.formatEvent = data.formatEvent;
              events.placeEvent = data.placeEvent;
              events.idEvent = newArrayPlaceForDataBase;
              this.eventsCalendarRepo.save(events);
              if (a.split('/')[1] === placeByBase) {
                this.updateEventForCalendarPrepareData(events.idLead);
              }
            });
          });

          deletePlace.map((a) => {
            let calendarId = this.config.get(a.replace(/\s+/g, ''));
            let deletePlace = a;
            eventId.map((a) => {
              if (a.split('/')[1] === deletePlace) {
                this.deleteEventForCalendarWithoutBase(
                  calendarId,
                  a.split('/')[0],
                  events.idLead,
                );
              }
            });
          });
        }
      } else {
        // если количество площадок не поменялось то нужно проверить та же площадка осталась или новая
        if (
          JSON.stringify(events.placeEvent) !== JSON.stringify(data.placeEvent)
        ) {
          // если массивы не равны значит площадка поменялась и нужно определить какая площадка стала и добавить событие по новым площадкам
          console.log(
            'Количество площадок не изменился, но изменились сами площадки',
          );
        } else {
          // площадки остались те же самые - нужно найти мероприятия и обновить по ним  данные
          console.log('Площадки не поменялись - просто обновляем данные');
          // обновляем данные в базе данных и делаем запрос на обновление из базы
          events.leadName = data.leadName;
          events.status_id = data.status_id;
          events.nameEvent = data.nameEvent;
          events.numGuests = data.numGuests;
          events.responsible_user = data.responsible_user;
          events.dataStartEvent = data.dataStartEvent;
          events.dataEndEvent = data.dataEndEvent;
          events.formatEvent = data.formatEvent;
          await this.eventsCalendarRepo.save(events);
          await this.updateEventForCalendarPrepareData(data.idLead);
        }
      }
    }
  }
  //NEW ОПРЕДЕЛЯЕМ СОБЫТИЕ И ОБНОВЛЯЕМ В НЕМ ДАННЫЕ

  async updateEventForCalendarPrepareData(idLead) {
    let events = await this.findByEventId(idLead);

    console.log('Здесь мы получаем из базы уже обновленные данные?', events);

    events.idEvent.map((a) => {
      let idEvent = a.split('/')[0];
      let calendarIdName = a.split('/')[1].replace(/\s+/g, '');
      let calendarId = this.config.get(`${calendarIdName}`);

      this.getEventForCalendar(calendarId, idEvent, events);
    });
  }

  async getEventForCalendar(calendarId, eventId, event) {
    let auth = await this.performCallback();
    const calendar = google.calendar({ version: 'v3', auth });

    console.log(event, 'что лежит в event');
    // сперва получает данные по событию из календаря
    const res = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId,
    });

    res.data.start = {
      dateTime: new Date(event.dataStartEvent * 1000).toISOString(),
      timeZone: 'Europe/Moscow',
    };
    res.data.end = {
      dateTime: new Date(event.dataEndEvent * 1000).toISOString(),
      timeZone: 'Europe/Moscow',
    };

    res.data.summary = `${this.config.get(event.status_id)} ${
      event.formatEvent
    } / ${event.nameEvent} / ${event.numGuests} гостей `;

    this.updateEventForCalendar(calendarId, eventId, res);
  }

  // Обновляем данные в календаре

  async updateEventForCalendar(calendarId, eventId, event) {
    let auth = await this.performCallback();
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.update(
      {
        calendarId: calendarId,
        eventId: eventId,
        requestBody: event.data,
      },
      (err, event) => {
        if (err) {
          console.log('Ошибка обновления события' + err);
          return;
        }
        console.log('Событие в календаре успешно обновлено', event.data);
      },
    );
  }

  // выполняем поиск события в базе
  async findByEventId(idLead) {
    return this.eventsCalendarRepo.findOne({
      where: {
        idLead,
      },
    });
  }

  // ПРОСТО ПОУЧАЕМ СОБЫТИЕ В КАЛЕНДАРЕ

  async getEventsNew(calendarId, eventId) {
    let auth = await this.performCallback();
    const calendar = google.calendar({ version: 'v3', auth });

    // в res получили событие которое можем дальше использовать или наполнить данными и обновить или удалить
    const res = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId,
    });

    return res;
  }

  // Получить событие и обновить в нем данные / нужно заменить на простой поиск события и вслучае необходимости уже в другом сценирии менять данные
  async getEvent(calendarId, eventId, events) {
    let auth = await this.performCallback();
    const calendar = google.calendar({ version: 'v3', auth });

    const res = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId,
    });
    let dataStartEvent;
    let dataEndEvent;
    let statusEvent;
    let formatEvent;
    let nameEvent;
    let numGuests;

    events.forEach((event) => {
      dataStartEvent = event.dataStartEvent;
      dataEndEvent = event.dataEndEvent;
      statusEvent = event.statusEvent;
      formatEvent = event.formatEvent;
      nameEvent = event.nameEvent;
      numGuests = event.numGuests;
    });

    res.data.start = {
      dateTime: new Date(dataStartEvent * 1000).toISOString(),
      timeZone: 'Europe/Moscow',
    };
    res.data.end = {
      dateTime: new Date(dataEndEvent * 1000).toISOString(),
      timeZone: 'Europe/Moscow',
    };
    res.data.summary = `${statusEvent} ${formatEvent} / ${nameEvent} / ${numGuests} гостей `;

    this.updateEvent(calendarId, eventId, res);
  }

  // Обновление события в календаре
  async updateEvent(calendarId, eventId, event) {
    let auth = await this.performCallback();
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.update(
      {
        calendarId: calendarId,
        eventId: eventId,
        requestBody: event.data,
      },
      (err, event) => {
        if (err) {
          console.log('Ошибка обновления события' + err);
          return;
        }
        console.log('Событие в календаре успешно обновлено', event.data);
      },
    );
  }

  // удаление события из календаря и из базы
  async deleteEventForCalendar(calendarId, eventId, idLead) {
    let auth = await this.performCallback();
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({ calendarId, eventId }, (err, event) => {
      if (err) {
        console.log('не удалось удалить событие из календаря' + err);
        return;
      }
      console.log('Событие успешно удалено');
      this.deleteEventForBase(idLead);
    });
  }

  // нужно удалить из базы информацию о том какое событие происходит
  async deleteEventForCalendarWithoutBase(calendarId, eventId, idLead) {
    let auth = await this.performCallback();
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({ calendarId, eventId }, (err, event) => {
      if (err) {
        console.log('не удалось удалить событие из календаря' + err);
        return;
      }
      console.log('Событие успешно удалено');
      // запускаем код по удалению события из базы данных, нужно передать ID сделки чтобы по ней найти событие
      // this.deleteEventForBaseContain(idLead, eventId);
    });
  }

  /// удалить запись в базу данных
  async deleteEventForBase(idLead) {
    return this.eventsCalendarRepo.delete({ idLead });
  }

  /// добавление в базу связанного события
  async insertIdEventForBase(data, playload, eventPlace) {
    let events = await this.findByEventId(playload.idLead);
    playload.idEvent.push(`${data.id}/${eventPlace}`);
    this.eventsCalendarRepo.save(playload);
  }
}
