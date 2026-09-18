import { Module } from '@nestjs/common';
import { R2Service } from './r2.service';
import { FileUrlService } from './file-url.service';

@Module({
  providers: [R2Service, FileUrlService],
  exports: [R2Service, FileUrlService],
})
export class R2Module {}
