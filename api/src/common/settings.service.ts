import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_SETTINGS, SETTING_FIELDS } from './constants';
import { Setting } from '../entities';

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Setting) private readonly settings: Repository<Setting>) {}

  async all(): Promise<Record<string, string>> {
    const out: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const s of await this.settings.find()) out[s.key] = s.value;
    return out;
  }

  async save(values: Record<string, unknown>) {
    for (const key of SETTING_FIELDS) {
      const value = String(values[key] ?? '').replace(/\r\n/g, '\n').trim();
      await this.settings.save({ key, value });
    }
    return this.all();
  }
}
