import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from '../queue/queue.config';
import { SeriesModule } from '../series/series.module';
import { FiscalController } from './fiscal.controller';
import { FiscalEmissionProcessor } from './fiscal-emission.processor';
import { FiscalEmissionService } from './fiscal-emission.service';
import { FISCAL_GATEWAY } from './fiscal.gateway';
import { FiscalNoopQueueService, FiscalQueueService } from './fiscal-queue.service';
import { FiscalService } from './fiscal.service';
import { SefazScSoapClient } from './sefaz-sc/sefaz-sc.soap-client';
import { SefazScGateway } from './sefaz-sc.gateway';
import { PfxKeyMaterialService } from './signing/pfx-key-material.service';
import { XmlSignerService } from './signing/xml-signer.service';
import { NfeXmlBuilderService } from './xml/nfe-xml.builder';

const hasRedis = Boolean(process.env.REDIS_URL);

@Module({
  imports: [
    SeriesModule,
    ...(hasRedis ? [BullModule.registerQueue({ name: QUEUE_NAMES.FISCAL_EMISSION })] : []),
  ],
  controllers: [FiscalController],
  providers: [
    FiscalService,
    FiscalEmissionService,
    SefazScGateway,
    SefazScSoapClient,
    PfxKeyMaterialService,
    XmlSignerService,
    NfeXmlBuilderService,
    ...(hasRedis
      ? [FiscalQueueService, FiscalEmissionProcessor]
      : [{ provide: FiscalQueueService, useClass: FiscalNoopQueueService }]),
    {
      provide: FISCAL_GATEWAY,
      useExisting: SefazScGateway,
    },
  ],
  exports: [FiscalService, FiscalEmissionService, FISCAL_GATEWAY],
})
export class FiscalModule {}
