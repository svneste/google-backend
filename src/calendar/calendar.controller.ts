import { Controller, Get, All, Body } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { AccountsService } from 'src/accounts/accounts.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService, private accountService: AccountsService) {}
  @Get()
  async getCalendar(): Promise<any> {
    return 
  }

  @All('webhooks')
  async webhooks(@Body() body: any) {
    let leadId;
    body.leads.status.map((a) => (leadId = a.id)); 
    this.accountService.addEventsForArrayBase(leadId, body.account.id);
  }
}
