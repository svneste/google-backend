import { Module } from '@nestjs/common';
import { AccountSetupService } from './account-setup.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountSetup } from './account-setup.entity';
import { AccountSetupController } from './account-setup.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccountSetup], )], 
  providers: [AccountSetupService],
  exports: [AccountSetupService],
  controllers: [AccountSetupController],
})
export class AccountSetupModule {}
