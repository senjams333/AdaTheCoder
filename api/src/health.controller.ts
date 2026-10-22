import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DataSource) {}

  /** GET /api/health: is the API running and can it reach the database? */
  @Get()
  async health() {
    try {
      await this.db.query('SELECT 1');
      return { ok: true, database: 'up' };
    } catch {
      return { ok: false, database: 'down' };
    }
  }
}
