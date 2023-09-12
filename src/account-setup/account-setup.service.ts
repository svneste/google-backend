import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccountSetup } from './account-setup.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AccountSetupService {
  constructor(
    @InjectRepository(AccountSetup)
    private accountSetupRepo: Repository<AccountSetup>,
  ) {}

  //   onModuleInit() {
  //     let data = {
  //         amoId: 30062854,
  //         domain: 'eventmoskvaa.amocrm.ru',
  //         placeList: [],
  //     };

  //       data.placeList = [
  //        'BlaBlaBar/900c995acec8ef6f5436045f6f596ee236bec627ad9d12979e987016874de2f3@group.calendar.google.com', 'NEBO/b99ff8e5b8293cb5bd46d1e3305ba9847dfd8d8e4b81708fabd288f3fe2d9dc3@group.calendar.google.com',
  //        'Известия Hall/132569f45c049a9253c939aa7e2200765f92411670ec5127b95b5ab8ace8f160@group.calendar.google.com'
  //       ]

  //     this.accountSetupRepo.save( data );
  //   }

//   async onModuleInit() {
//     let configData =  await this.getAccountSetup(30062854);

//     console.log(configData.placeList);
//   }

  async getAccountSetup(amoId) {
    return await this.accountSetupRepo.findOne({
        where: {
          amoId,
        },
      });
  }


}


