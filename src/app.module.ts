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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
    //   port: 5431,
    //  username: 'postgres',
    //   password: '123',
    //  database: 'nestjs',
    
      port: 5432,
      username: 'svneste3',
      password: '37043704',
      database: 'google',
      autoLoadEntities: true,
      synchronize: true,
    }),
    AccountsModule,
    AuthModule,
    CalendarModule,
    AccountSetupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
