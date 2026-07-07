import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../../database/entities/auth/user.entity';

const makeUser = async (overrides: Partial<{ currentRefreshTokenHash: string | null }> = {}) => ({
  id: 'uuid-1',
  email: 'test@test.com',
  passwordHash: await argon2.hash('password123'),
  currentRefreshTokenHash: overrides.currentRefreshTokenHash ?? null,
  roles: [
    { name: 'Employee', permissions: [{ key: 'leave.apply' }, { key: 'attendance.clockIn' }] },
  ],
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: { findOne: jest.Mock; update: jest.Mock };
  let jwtSvc: { sign: jest.Mock; decode: jest.Mock };

  beforeEach(async () => {
    const user = await makeUser();
    userRepo = { findOne: jest.fn().mockResolvedValue(user), update: jest.fn() };
    jwtSvc = { sign: jest.fn().mockReturnValue('mocked-token'), decode: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: JwtService, useValue: jwtSvc },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (k: string) =>
              ({ JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) }[k] ?? ''),
            get: (k: string) =>
              ({ JWT_ACCESS_EXPIRES_IN: '15m', JWT_REFRESH_EXPIRES_IN: '7d' }[k]),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('returns tokens and flattened permissions on valid credentials', async () => {
    const result = await service.login({ email: 'test@test.com', password: 'password123' });
    expect(result.accessToken).toBe('mocked-token');
    expect(result.user.permissions).toContain('leave.apply');
    expect(jwtSvc.sign).toHaveBeenCalledTimes(2);
  });

  it('throws on wrong password', async () => {
    await expect(service.login({ email: 'test@test.com', password: 'wrong' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('throws when user not found', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(service.login({ email: 'x@x.com', password: 'any' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('stores a hash of the issued refresh token', async () => {
    await service.login({ email: 'test@test.com', password: 'password123' });
    const updateCall = userRepo.update.mock.calls.find((c) => 'currentRefreshTokenHash' in c[1]);
    expect(updateCall).toBeDefined();
    const storedHash = updateCall![1].currentRefreshTokenHash;
    expect(await argon2.verify(storedHash, 'mocked-token')).toBe(true);
  });

  it('refresh() rejects when there is no stored refresh token hash', async () => {
    userRepo.findOne.mockResolvedValue(await makeUser({ currentRefreshTokenHash: null }));
    await expect(service.refresh('uuid-1', 'some-token')).rejects.toThrow(UnauthorizedException);
  });

  it('refresh() rejects when the presented token does not match the stored hash', async () => {
    const storedHash = await argon2.hash('the-real-refresh-token');
    userRepo.findOne.mockResolvedValue(await makeUser({ currentRefreshTokenHash: storedHash }));
    await expect(service.refresh('uuid-1', 'a-stolen-old-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refresh() succeeds and rotates the stored hash when the presented token matches', async () => {
    const storedHash = await argon2.hash('the-real-refresh-token');
    userRepo.findOne.mockResolvedValue(await makeUser({ currentRefreshTokenHash: storedHash }));
    const result = await service.refresh('uuid-1', 'the-real-refresh-token');
    expect(result.accessToken).toBe('mocked-token');
  });

  it('logout() clears the stored refresh token hash for the decoded user', async () => {
    jwtSvc.decode.mockReturnValue({ sub: 'uuid-1' });
    await service.logout('some-refresh-token');
    expect(userRepo.update).toHaveBeenCalledWith('uuid-1', { currentRefreshTokenHash: null });
  });

  it('logout() is a no-op when there is no token to decode', async () => {
    await service.logout(undefined);
    expect(userRepo.update).not.toHaveBeenCalled();
  });
});
