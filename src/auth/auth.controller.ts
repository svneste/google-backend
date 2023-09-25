import { All, Controller, Query, Res, Body, Post } from '@nestjs/common';
import { AuthCallbackQuery } from 'src/interfaces/auth-callback-query.interface';
import { AuthService } from './auth.service';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @All('/callback')
  async callback(@Query() query: AuthCallbackQuery, @Res() res: Response) {
    return res.redirect(await this.authService.performCallback(query));
  }
}
