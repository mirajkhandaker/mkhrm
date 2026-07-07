import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from '../../database/entities/auth/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    return this.issueTokens(user);
  }

  async refresh(userId: string, presentedToken: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException();

    if (!user.currentRefreshTokenHash) throw new UnauthorizedException();
    const valid = await argon2.verify(user.currentRefreshTokenHash, presentedToken);
    if (!valid) throw new UnauthorizedException();

    return this.issueTokens(user);
  }

  async logout(presentedToken: string | undefined) {
    if (!presentedToken) return;
    const decoded = this.jwt.decode(presentedToken) as { sub?: string } | null;
    if (decoded?.sub) {
      await this.userRepo.update(decoded.sub, { currentRefreshTokenHash: null });
    }
  }

  private async issueTokens(user: User) {
    const roles = user.roles?.map((r) => r.name) ?? [];
    const permissions = [
      ...new Set(
        user.roles?.flatMap((r) => r.permissions?.map((p) => p.key) ?? []) ?? [],
      ),
    ];
    const payload = { sub: user.id, email: user.email, roles, permissions };

    const accessToken = this.jwt.sign(payload, {
      secret: this.cfg.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.cfg.get('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });
    const refreshToken = this.jwt.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.cfg.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.cfg.get('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      },
    );

    const currentRefreshTokenHash = await argon2.hash(refreshToken);
    await this.userRepo.update(user.id, { currentRefreshTokenHash });

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, roles, permissions } };
  }
}
