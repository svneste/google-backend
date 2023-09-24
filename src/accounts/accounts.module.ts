import { Module, forwardRef } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './account.entity';
import { AuthModule } from 'src/auth/auth.module';
import { CalendarModule } from 'src/calendar/calendar.module';
import { GoogleModule } from 'src/google/google.module';

@Module({
  imports: [forwardRef(() => AuthModule), TypeOrmModule.forFeature([Account]), forwardRef(() => CalendarModule), GoogleModule ],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
