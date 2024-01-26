import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Account } from './account.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { AuthService } from 'src/auth/auth.service';
import { GrantTypes } from 'src/enums/grant-types.enum';
import { CalendarService } from 'src/calendar/calendar.service';
import { ConfigService } from '@nestjs/config';
import { GoogleService } from 'src/google/google.service';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private accountsRepo: Repository<Account>,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
    private calendarService: CalendarService,
    private config: ConfigService,
    private googleService: GoogleService,
  ) {}

  findByAmoId(amoId: number): Promise<Account> {
    return this.accountsRepo.findOne({
      where: {
        amoId,
      },
    });
  }

  create(data: Partial<Account>) {
    return this.accountsRepo.save(data);
  }

  async update(id: number, data: Partial<Account>) {
    await this.accountsRepo.save({ ...data, id });
    return this.accountsRepo.findOne({
      where: {
        id,
      },
    });
  }

  createConnector(amoId: any): any {
    const api = axios.create();
    let account: Account;

    api.interceptors.request.use(
      async (config) => {
        if (!account) account = await this.findByAmoId(amoId);
        const { oauth } = account;

        if (oauth.expire - 60 * 1000 < Number(new Date())) {
          account = await this.update(account.id, {
            oauth: await this.authService.getNewTokens(
              oauth.refreshToken,
              account.domain,
              GrantTypes.RefreshToken,
            ),
          });
        }

        config.baseURL = account.url;
        config.headers.Authorization = `Bearer ${account.oauth.accessToken}`;
        return config;
      },
      (e) => Promise.reject(e),
    );

    return api;
  }

  async addEventsForArrayBase(leadId, accountId) {
    const api = this.createConnector(31208198);
    const leadsList = await api.get(`/api/v4/leads/${leadId}`);

    const playload = {
      idLead: leadsList.data.id,
      leadName: leadsList.data.name,
      responsible_user: '',
      leadLink: '',
      status_id: leadsList.data.status_id,
      pipeline_id: leadsList.data.pipeline_id,
      statusEvent: '',
      dataStartEvent: '',
      dataEndEvent: '',
      nameEvent: '',
      formatEvent: '',
      numGuests: '',
      placeEvent: [],
      idEvent: [],
      comment: '',
    };

    playload.leadLink = `https://sagrado.amocrm.ru/leads/detail/${leadsList.data.id}`;

    //playload.responsible_user = leadsList.data.responsible_user_id;
    playload.statusEvent = leadsList.data.status_id;

    leadsList.data.custom_fields_values.map((a) => {
      if (a.field_id === 710465 || a.field_id === 2626327) {
        a.values.map((a) => (playload.dataStartEvent = a.value));
      }
      // добавляем код
      if (a.field_id === 434941) {
        a.values.map((a) => (playload.comment = a.value));
      }

      if (a.field_id === 636475) {
        a.values.map((a) => (playload.responsible_user = a.value));
      }
      if (a.field_id === 710467 || a.field_id === 2626329) {
        a.values.map((a) => (playload.dataEndEvent = a.value));
      }
      if (a.field_id === 710473 || a.field_id === 2679885) {
        a.values.map((a) => (playload.nameEvent = a.value));
      }
      if (a.field_id === 434935 || a.field_id === 2679887) {
        a.values.map((a) => (playload.numGuests = a.value));
      }
      if (a.field_id === 646099) {
        a.values.map((a) => (playload.formatEvent = a.value));
      }
      if (a.field_id === 435197 || 2679883) {
        // playload.placeEvent = a.values.map((a) => (a.value));

        a.values.map((a) => {
          if (a.value === 'Известия Hall') {
            playload.placeEvent.push('Hall');
          } else if (a.value === 'Мир') {
            playload.placeEvent.push('World');
          } else {
            playload.placeEvent.push(a.value);
          }
        });
      }
    });

    console.log('Подготовить данные для передачи', playload);

    this.calendarService.checkRequestByDelete(playload);
  }

  async createLead(dataForLead) {
    console.log(dataForLead.name);
    const api = this.createConnector(31208198);

    await api.post('/api/v4/leads', [
      {
        name: dataForLead.name,
        created_by: 0,
        price: dataForLead.price,
      },
    ]);
  }
}
