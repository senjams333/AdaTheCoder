import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITIES } from '../entities';
import { ThemePackService } from '../packs/theme-pack.service';
import { SeedService } from '../seed/seed.service';
import { CatalogService } from './catalog.service';

/** Database access shared by every part of the API. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  providers: [CatalogService, SeedService, ThemePackService],
  exports: [CatalogService, ThemePackService, TypeOrmModule],
})
export class CatalogModule {}
