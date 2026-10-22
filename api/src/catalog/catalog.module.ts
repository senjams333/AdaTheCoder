import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITIES } from '../entities';
import { SeedService } from '../seed/seed.service';
import { CatalogService } from './catalog.service';

/** Database access shared by every part of the API. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  providers: [CatalogService, SeedService],
  exports: [CatalogService, TypeOrmModule],
})
export class CatalogModule {}
