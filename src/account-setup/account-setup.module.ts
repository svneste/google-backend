import { Module } from '@nestjs/common';
import { AccountSetupService } from './account-setup.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountSetup } from './account-setup.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccountSetup])], 
  providers: [AccountSetupService],
  exports: [AccountSetupService],
})
export class AccountSetupModule {}
