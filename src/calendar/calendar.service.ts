import { Injectable } from '@nestjs/common';
import { authenticate } from '@google-cloud/local-auth';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { InjectRepository } from '@nestjs/typeorm';
import { Calendar } from './calendar.entity';
import { Repository } from 'typeorm';
import { OAuth2Client } from 'google-auth-library';
import { GoogleService } from 'src/google/google.service';
const path = require('node:path');
const fs = require('fs').promises;

@Injectable()
export class CalendarService {
  constructor(
    private config: ConfigService,
    @InjectRepository(Calendar)
    private eventsCalendarRepo: Repository<Calendar>,
    private googleService: GoogleService,
  ) {}

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
    const auth = await this.googleService.authorized(30062854);
    const calendar = google.calendar({ version: 'v3', auth });

    const date = new Date(events.dataStartEvent * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStart = `${hours}:${minutes}`;

    const dateEnd = new Date(events.dataEndEvent * 1000);

    const yearEnd = dateEnd.getFullYear();
    const monthEnd = String(dateEnd.getMonth() + 1).padStart(2, '0');
    const dayEnd = String(dateEnd.getDate() + 1).padStart(2, '0');
    const formattedDateEnd = `${yearEnd}-${monthEnd}-${dayEnd}`;

    const hoursEnd = String(dateEnd.getHours()).padStart(2, '0');
    const minutesEnd = String(dateEnd.getMinutes()).padStart(2, '0');
    const timeEnd = `${hoursEnd}:${minutesEnd}`;

    calendar.events.insert(
      {
        auth: auth,
        calendarId: calendarId,
        requestBody: {
          summary: `${this.config.get(events.statusEvent)} ${
            events.formatEvent
          } / ${events.nameEvent} / ${timeStart} : ${timeEnd} / 
          ${events.numGuests} гостей`,
          location: `${namePlace}`,
          description: `Менеджер в amoCRM: ${events.responsible_user} <br />Ссылка на сделку в <a href="${events.leadLink}"> amoCRM </a> `,
          start: {
            date: formattedDate,
            timeZone: 'Europe/Moscow',
          },
          end: {
            date: formattedDateEnd,
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
    data.idEvent.push(`${infoByEvent.id}/${namePlace}`);
    this.eventsCalendarRepo.save(data);
  }

  // отдельный сценарий на удаление если площадки изменились но не изменилось количество
  async deleteSaveEvent(events, data) {
    events.idEvent.map((a) => {
      const calendar = a.split('/')[1].replace(/\s+/g, '');
      const calendarId = this.config.get(`${calendar}`);

      const eventId = a.split('/')[0];

      this.deleteEventForCalendarIf(calendarId, eventId, events.idLead, data);
    });
  }

  // удаляем из календаря для ситуации когда количество площадок не поменялось
  async deleteEventForCalendarIf(calendarId, eventId, idLead, data) {
    const auth = await this.googleService.authorized(30062854);
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({ calendarId, eventId }, (err, event) => {
      if (err) {
        console.log('не удалось удалить событие из календаря' + err);
        this.deleteEventForBase(idLead);
        return;
      }
      console.log('Событие успешно удалено');
      this.deleteEventForBaseIf(idLead, data);
    });
  }

  async deleteEventForBaseIf(idLead, data) {
    await this.eventsCalendarRepo.delete({ idLead });
  }

  // получаем данные из базы и подготовливаем для передачи в GOOGLE
  async prepareDateForCalendar(idLead) {
    const events = await this.findByEventId(idLead);
    console.log(events, 'events');
    // нужно получить календарь ID чтобы понимать куда добавлять событие
    events.placeEvent.map((a) => {
      const namePlace = a;
      const namePlaceForEnv = a.replace(/\s+/g, '');
      const calendarId = this.config.get(`${namePlaceForEnv}`);
      this.insertEventsByDateBase(events, calendarId, namePlace);
    });
  }

  // Старт. Ищем событие в базе. Проверяем если статус нереализовано удаляем событие

  async checkRequestByDelete(data) {
    const events = await this.findByEventId(data.idLead);

    if (data.status_id === 143) {
      if (!events) {
        return;
      } else {
        // здесь выполняем поиск события и удаляем его из календаря и базы
        events.idEvent.map((a) => {
          const idEvent = a.split('/')[0];
          const calendarIdName = a.split('/')[1].replace(/\s+/g, '');
          const calendarId = this.config.get(`${calendarIdName}`);
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

        // по тем евентам у которых записи нет нужно запись добавить
        if (events.placeEvent.length < data.placeEvent.length) {
          console.log(
            'добавилась новая площадка нужно по ней создать запись в календаре',
          );

          // сравниваем два массива и находим новые элементы - которые сохраняем в новый массив и для этого массива создаем новые события
          const newPlace = data.placeEvent.filter(
            (item) => !events.placeEvent.includes(item),
          );
          const placeByBase = data.placeEvent.filter((item) =>
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
            const calendarId = this.config.get(a.replace(/\s+/g, ''));
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
            const calendarId = this.config.get(a.replace(/\s+/g, ''));
            this.insertEventsByDateBase(events, calendarId, a);
          });
        }

        // по тем евентам которых больше нет - нужно запись удалить //события которые остались нужно обновить + обновить информацию по ним в базе данных
        if (events.placeEvent.length > data.placeEvent.length) {
          console.log(
            'Площадок стало меньше нужно убрать лишние события из календаря',
          );
          const deletePlace = events.placeEvent.filter(
            (item) => !data.placeEvent.includes(item),
          );
          const placeByBase = events.placeEvent.filter((item) =>
            data.placeEvent.includes(item),
          );
          const newArrayPlaceForDataBase = [];
          const eventId = events.idEvent;
          const eventIdResult = [];

          // перебираем этот массив с идентификатора событий и готовим новый массив который нужно сохранить в базе и обработать
          eventId.map((a) => {
            const eventId = a;
            placeByBase.map((a) => {
              if (eventId.split('/')[1] === a) {
                eventIdResult.push(eventId);
              }
            });
          });

          console.log(eventIdResult, 'eventIdResult');

          placeByBase.map((a) => {
            const placeByBase = a;
            eventId.map((a) => {
              events.leadName = data.leadName;
              events.status_id = data.status_id;
              events.nameEvent = data.nameEvent;
              events.numGuests = data.numGuests;
              events.responsible_user = data.responsible_user;
              events.dataStartEvent = data.dataStartEvent;
              events.dataEndEvent = data.dataEndEvent;
              events.formatEvent = data.formatEvent;
              events.placeEvent = data.placeEvent;
              events.idEvent = eventIdResult;
              console.log('Запустили сохранение новых данных в базу:', events);
              this.updateDataForBase(events);

              // сделать так чтобы обновление событий было из базы
              this.updateEventForCalendarPrepareData(events.idLead);
            });
          });

          deletePlace.map((a) => {
            const calendarId = this.config.get(a.replace(/\s+/g, ''));
            const deletePlace = a;
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

          // делаем отдельный сценарий на удаление
          try {
            await this.deleteSaveEvent(events, data);
          } catch (err) {
            console.log('Ошибка');
          }

          //this.saveDataForBase(data);
          //this.prepareDateForCalendar(data.idLead);
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
    const events = await this.findByEventId(idLead);

    events.idEvent.map((a) => {
      const idEvent = a.split('/')[0];
      const calendarIdName = a.split('/')[1].replace(/\s+/g, '');
      const calendarId = this.config.get(`${calendarIdName}`);

      this.getEventForCalendar(calendarId, idEvent, events, idLead);
    });
  }

  async getEventForCalendar(calendarId, eventId, event, idLead) {
    const auth = await this.googleService.authorized(30062854);
    const calendar = google.calendar({ version: 'v3', auth });

    const date = new Date(event.dataStartEvent * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStart = `${hours}:${minutes}`;

    const dateEnd = new Date(event.dataEndEvent * 1000);

    const yearEnd = dateEnd.getFullYear();
    const monthEnd = String(dateEnd.getMonth() + 1).padStart(2, '0');
    const dayEnd = String(dateEnd.getDate()).padStart(2, '0');
    const formattedDateEnd = `${yearEnd}-${monthEnd}-${dayEnd}`;

    const hoursEnd = String(dateEnd.getHours()).padStart(2, '0');
    const minutesEnd = String(dateEnd.getMinutes()).padStart(2, '0');
    const timeEnd = `${hoursEnd}:${minutesEnd}`;

    // сперва получает данные по событию из календаря

    const res = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId,
    });

    res.data.start = {
      date: formattedDate,
      timeZone: 'Europe/Moscow',
    };
    res.data.end = {
      date: formattedDateEnd,
      timeZone: 'Europe/Moscow',
    };

    res.data.summary = `${this.config.get(event.status_id)} ${
      event.formatEvent
    } / ${event.nameEvent} / ${timeStart} : ${timeEnd} / ${event.numGuests} гостей `;

    this.updateEventForCalendar(calendarId, eventId, res);
  }

  // Обновляем данные в календаре

  async updateEventForCalendar(calendarId, eventId, event) {
    const auth = await this.googleService.authorized(30062854);
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
    const auth = await this.googleService.authorized(30062854);
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
    const auth = await this.googleService.authorized(30062854);
    const calendar = google.calendar({ version: 'v3', auth });

    const date = new Date(events.dataStartEvent * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStart = `${hours}:${minutes}`;

    const dateEnd = new Date(events.dataEndEvent * 1000);

    const yearEnd = dateEnd.getFullYear();
    const monthEnd = String(dateEnd.getMonth() + 1).padStart(2, '0');
    const dayEnd = String(dateEnd.getDate()).padStart(2, '0');
    const formattedDateEnd = `${yearEnd}-${monthEnd}-${dayEnd}`;

    const hoursEnd = String(dateEnd.getHours()).padStart(2, '0');
    const minutesEnd = String(dateEnd.getMinutes()).padStart(2, '0');
    const timeEnd = `${hoursEnd}:${minutesEnd}`;

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
      date: formattedDate,
      timeZone: 'Europe/Moscow',
    };
    res.data.end = {
      date: formattedDateEnd,
      timeZone: 'Europe/Moscow',
    };
    res.data.summary = `${statusEvent} ${formatEvent} / ${nameEvent} / ${timeStart} : ${timeEnd} / ${numGuests} гостей `;

    this.updateEvent(calendarId, eventId, res);
  }

  // Обновление события в календаре
  async updateEvent(calendarId, eventId, event) {
    const auth = await this.googleService.authorized(30062854);
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
    const auth = await this.googleService.authorized(30062854);
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({ calendarId, eventId }, (err, event) => {
      if (err) {
        console.log('не удалось удалить событие из календаря' + err);
        this.deleteEventForBase(idLead);
        return;
      }
      console.log('Событие успешно удалено');
      this.deleteEventForBase(idLead);
    });
  }

  // Обновляем данные в базе

  async updateDataForBase(events) {
    await this.eventsCalendarRepo.save(events);
  }

  async saveDataForBase(data) {
    this.eventsCalendarRepo.save(data);
  }

  // нужно удалить из базы информацию о том какое событие происходит
  async deleteEventForCalendarWithoutBase(calendarId, eventId, idLead) {
    const auth = await this.googleService.authorized(30062854);
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({ calendarId, eventId }, (err, event) => {
      if (err) {
        return;
      }
      console.log('Событие успешно удалено');
      // запускаем код по удалению события из базы данных, нужно передать ID сделки чтобы по ней найти событие
      // this.deleteEventForBaseContain(idLead, eventId);
    });
  }

  /// удалить запись в базу данных
  async deleteEventForBase(idLead) {
    this.eventsCalendarRepo.delete({ idLead });
  }

  /// добавление в базу связанного события
  async insertIdEventForBase(data, playload, eventPlace) {
    const events = await this.findByEventId(playload.idLead);
    playload.idEvent.push(`${data.id}/${eventPlace}`);
    this.eventsCalendarRepo.save(playload);
  }

  async deleteEventIfCancelled(eventId, idLead) {
    const events = await this.findByEventId(idLead);
    const newArrayEventId = [];
    const index = events.idEvent.indexOf(eventId);
    if (index !== -1) {
      events.idEvent.splice(index, 1);
      console.log('events.idEvent', events.idEvent);
    }
  }
}
