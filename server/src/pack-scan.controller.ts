import { Body, Controller, Post, HttpException, HttpStatus } from '@nestjs/common';
import { PackScanService } from './pack-scan.service';

interface ScanRequest {
  imageBase64: string;
}

@Controller()
export class PackScanController {
  constructor(private readonly packScanService: PackScanService) {}

  @Post('pack-scan')
  async scan(@Body() body: ScanRequest) {
    if (!body?.imageBase64) {
      throw new HttpException('imageBase64 is required', HttpStatus.BAD_REQUEST);
    }
    return this.packScanService.extractCode(body.imageBase64);
  }
}
