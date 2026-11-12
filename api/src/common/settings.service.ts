import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_SETTINGS, LEGACY_POLICY_PURCHASES, SETTING_FIELDS } from './constants';
import { LEGACY_POLICY_TERMS, SITE_TEXT_FIELDS } from './site-text';
import { Setting } from '../entities';

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Setting) private readonly settings: Repository<Setting>) {}

  async all(): Promise<Record<string, string>> {
    const out: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const s of await this.settings.find()) out[s.key] = s.value;
    // the old purchases text, saved unchanged, gives way to the current one (an edited text is kept)
    if ((out.policy_purchases || '').trim() === LEGACY_POLICY_PURCHASES.trim()) out.policy_purchases = DEFAULT_SETTINGS.policy_purchases;
    if ((out.policy_terms || '').trim() === LEGACY_POLICY_TERMS.trim()) out.policy_terms = DEFAULT_SETTINGS.policy_terms;
    // home sections and policy pages: an empty text, or a list that isn't readable, shows the built-in text
    for (const k of SITE_TEXT_FIELDS) {
      const v = (out[k] || '').trim();
      let ok = Boolean(v);
      if (ok && (k.endsWith('_items') || k === 'parents_facts')) {
        try { ok = Array.isArray(JSON.parse(v)) && JSON.parse(v).length > 0; } catch { ok = false; }
      }
      if (!ok) out[k] = DEFAULT_SETTINGS[k];
    }
    return out;
  }

  async save(values: Record<string, unknown>) {
    for (const key of SETTING_FIELDS) {
      const value = String(values[key] ?? '').replace(/\r\n/g, '\n').trim();
      await this.settings.save({ key, value });
    }
    return this.all();
  }

  /** One setting on its own (the uploaded home pictures: the form's Save never touches these). */
  async setOne(key: string, value: string) {
    await this.settings.save({ key, value });
  }
}
