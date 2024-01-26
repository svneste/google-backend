import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountsModule } from './accounts/accounts.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { config } from './config';
import { CalendarModule } from './calendar/calendar.module';
import { AccountSetupModule } from './account-setup/account-setup.module';
import { GoogleModule } from './google/google.module';
import { WinstonModule } from 'nest-winston';
const winston = require('winston');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '37043704',
      database: 'postgres',

      //port: 5432,
      //username: 'svneste3',
      //password: '37043704',
      //database: 'google',
      autoLoadEntities: true,
      synchronize: true,
    }),
    WinstonModule.forRoot({

      levels: {
        critical_error: 0,
        error: 1,
        special_warning: 2,
        another_log_level: 3,
        info: 4,
      },
      transports: [
        new winston.transports.Console({ format: winston.format.simple() }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
      ],
    }),
    AccountsModule,
    AuthModule,
    CalendarModule,
    AccountSetupModule,
    GoogleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
