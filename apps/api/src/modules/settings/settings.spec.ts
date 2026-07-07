import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Setting } from '../../database/entities/system/setting.entity';

function makeRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((data: Partial<Setting>) => data),
    save: jest.fn(async (data: Partial<Setting>) => data),
  };
}

async function buildService() {
  const settingRepo = makeRepo();
  const module: TestingModule = await Test.createTestingModule({
    providers: [SettingsService, { provide: getRepositoryToken(Setting), useValue: settingRepo }],
  }).compile();

  return { svc: module.get(SettingsService), settingRepo };
}

describe('SettingsService', () => {
  it('findAll returns all settings ordered by key', async () => {
    const { svc, settingRepo } = await buildService();
    settingRepo.find.mockResolvedValue([{ key: 'currency', value: 'BDT' }]);
    const result = await svc.findAll();
    expect(settingRepo.find).toHaveBeenCalledWith({ order: { key: 'ASC' } });
    expect(result).toEqual([{ key: 'currency', value: 'BDT' }]);
  });

  it('findOne throws NotFoundException for an unknown key', async () => {
    const { svc, settingRepo } = await buildService();
    settingRepo.findOne.mockResolvedValue(null);
    await expect(svc.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('findOne returns the setting when it exists', async () => {
    const { svc, settingRepo } = await buildService();
    settingRepo.findOne.mockResolvedValue({ key: 'timezone', value: 'Asia/Dhaka' });
    const result = await svc.findOne('timezone');
    expect(result).toEqual({ key: 'timezone', value: 'Asia/Dhaka' });
  });

  it('getValue returns the fallback when the key is missing', async () => {
    const { svc, settingRepo } = await buildService();
    settingRepo.findOne.mockResolvedValue(null);
    const result = await svc.getValue('terminated_data_retention_days', 730);
    expect(result).toBe(730);
  });

  it('getValue returns the stored value when present', async () => {
    const { svc, settingRepo } = await buildService();
    settingRepo.findOne.mockResolvedValue({ key: 'basic_to_gross_min_ratio', value: 0.6 });
    const result = await svc.getValue('basic_to_gross_min_ratio', 0.5);
    expect(result).toBe(0.6);
  });

  it('upsert updates an existing setting in place', async () => {
    const { svc, settingRepo } = await buildService();
    const existing = { key: 'currency', value: 'BDT' };
    settingRepo.findOne.mockResolvedValue(existing);
    const result = await svc.upsert('currency', 'USD');
    expect(existing.value).toBe('USD');
    expect(settingRepo.save).toHaveBeenCalledWith(existing);
    expect(result).toEqual(existing);
  });

  it('upsert creates a new setting when the key does not exist', async () => {
    const { svc, settingRepo } = await buildService();
    settingRepo.findOne.mockResolvedValue(null);
    await svc.upsert('new_key', 42);
    expect(settingRepo.create).toHaveBeenCalledWith({ key: 'new_key', value: 42 });
    expect(settingRepo.save).toHaveBeenCalledWith({ key: 'new_key', value: 42 });
  });
});
