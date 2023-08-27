import { Controller, Get } from '@nestjs/common';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}
  @Get()
  async getCalendar(): Promise<any> {
    return await this.calendarService.performCallback();
  }

  @Get('events')
  async getEvents() {
  //  return await this.calendarService.authorize();
  //  return await this.calendarService.performCallback().then(this.calendarService.insertEvent).catch(console.error);
  }

//   @Get('auth')
//   async getTest() {
//     return await this.calendarService.getEvents();
//   }
}
