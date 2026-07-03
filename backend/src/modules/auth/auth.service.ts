import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Company } from '../../entities/company.entity';
import { Permission } from '../../entities/permission.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /** Tenant bootstrap: creates the company, clones system role templates, creates the owner. */
  async registerCompany(dto: RegisterCompanyDto) {
    return this.dataSource.transaction(async (em) => {
      const company = await em.save(em.create(Company, { name: dto.companyName }));

      const templates = await em.find(Role, {
        where: { isSystem: true, companyId: IsNull() },
        relations: ['permissions'],
      });
      const cloned = await em.save(
        templates.map((t) =>
          em.create(Role, {
            companyId: company.id,
            name: t.name,
            description: t.description,
            isSystem: false,
            permissions: t.permissions,
          }),
        ),
      );
      const ownerRole = cloned.find((r) => r.name === 'Company Owner');

      const existing = await em.findOne(User, { where: { email: dto.email } });
      if (existing) throw new ConflictException('An account with this email already exists');

      const owner = await em.save(
        em.create(User, {
          companyId: company.id,
          email: dto.email,
          phone: dto.phone,
          fullName: dto.fullName,
          passwordHash: await bcrypt.hash(dto.password, 10),
          roles: ownerRole ? [ownerRole] : [],
        }),
      );

      void this.audit.log({
        companyId: company.id,
        userId: owner.id,
        action: 'company.register',
        entityType: 'company',
        entityId: company.id,
      });

      return { companyId: company.id, userId: owner.id };
    });
  }

  async login(dto: LoginDto, meta?: { ip?: string; userAgent?: string }) {
    const user = await this.users.findOne({ where: { email: dto.email, isActive: true } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.users.update(user.id, { lastLoginAt: new Date() });
    void this.audit.log({ companyId: user.companyId, userId: user.id, action: 'auth.login', ip: meta?.ip });
    const tokens = await this.issueTokens(user, meta);
    return { user: this.publicUser(user), ...tokens };
  }

  /** Rotates the refresh token: old one is revoked, a new pair is issued. */
  async refresh(rawToken: string, meta?: { ip?: string; userAgent?: string }) {
    const tokenHash = this.hash(rawToken);
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!stored) throw new UnauthorizedException('Refresh token is invalid or expired');
    await this.refreshTokens.update(stored.id, { revokedAt: new Date() });

    const user = await this.users.findOne({ where: { id: stored.userId, isActive: true } });
    if (!user) throw new UnauthorizedException('User is inactive');
    return this.issueTokens(user, meta);
  }

  async logout(rawToken: string) {
    await this.refreshTokens.update({ tokenHash: this.hash(rawToken) }, { revokedAt: new Date() });
    return { ok: true };
  }

  private async issueTokens(user: User, meta?: { ip?: string; userAgent?: string }): Promise<TokenPair> {
    const permissions = this.collectPermissions(user);
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        companyId: user.companyId,
        email: user.email,
        fullName: user.fullName,
        roles: (user.roles ?? []).map((r) => r.name),
        permissions,
      },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '900s'),
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const ttlDays = Number(this.config.get('JWT_REFRESH_TTL_DAYS', 7));
    await this.refreshTokens.insert({
      userId: user.id,
      tokenHash: this.hash(refreshToken),
      expiresAt: new Date(Date.now() + ttlDays * 24 * 3600 * 1000),
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return { accessToken, refreshToken };
  }

  private collectPermissions(user: User): string[] {
    const set = new Set<string>();
    for (const role of user.roles ?? []) {
      for (const p of role.permissions ?? []) set.add(p.code);
    }
    return [...set];
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      fullName: user.fullName,
      roles: (user.roles ?? []).map((r) => r.name),
      permissions: this.collectPermissions(user),
    };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
