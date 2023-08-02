import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Account } from './account.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosInstance } from 'axios';
import { AuthService } from 'src/auth/auth.service';
import { GrantTypes } from 'src/enums/grant-types.enum';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private accountsRepo: Repository<Account>,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {}

  async onModuleInit() {
    const api = this.createConnector(31208198);
    console.log(await api.get('/api/v4/account'));
    
  }

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
}
