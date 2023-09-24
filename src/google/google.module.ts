import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { GoogleController } from './google.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Google } from './google.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Google])],
    providers: [GoogleService],
    exports: [GoogleService],
    controllers: [GoogleController],
})
export class GoogleModule {}
