import { Module, forwardRef } from '@nestjs/common';
import { Calendar } from './calendar.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { AccountsModule } from 'src/accounts/accounts.module';
import { GoogleModule } from 'src/google/google.module';

@Module({
  imports: [TypeOrmModule.forFeature([Calendar]), forwardRef(() => AccountsModule), GoogleModule ],
  providers: [CalendarService],
  controllers: [CalendarController],
  exports: [CalendarService],
})
export class CalendarModule {}
