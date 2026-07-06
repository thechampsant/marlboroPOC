import { Module } from '@nestjs/common';
import { PackScanController } from './pack-scan.controller';
import { PackScanService } from './pack-scan.service';

@Module({
  controllers: [PackScanController],
  providers: [PackScanService],
})
export class AppModule {}
