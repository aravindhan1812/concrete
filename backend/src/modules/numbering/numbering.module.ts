import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NumberingSeries } from '../../entities/shared.entities';
import { NumberingController } from './numbering.controller';
import { NumberingService } from './numbering.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([NumberingSeries])],
  controllers: [NumberingController],
  providers: [NumberingService],
  exports: [NumberingService],
})
export class NumberingModule {}
