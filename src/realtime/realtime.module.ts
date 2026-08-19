import { Module } from '@nestjs/common';
import { ExhibitionGateway } from './exhibition.gateway';

@Module({
  providers: [ExhibitionGateway],
})
export class RealtimeModule {}
