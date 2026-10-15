import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, DataScope, UserKind } from '../../common/types';

interface JwtPayload {
  sub: string;
  companyId: string;
  email?: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  kind?: UserKind;
  dataScope?: DataScope;
  clientId?: string;
  vendorId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret'),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      userId: payload.sub,
      companyId: payload.companyId,
      email: payload.email,
      fullName: payload.fullName,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      kind: payload.kind ?? 'staff',
      // Tokens issued before data scopes existed fall back to the narrowest sensible default.
      dataScope: payload.dataScope ?? (payload.kind && payload.kind !== 'staff' ? 'own_records' : 'assigned_projects'),
      clientId: payload.clientId,
      vendorId: payload.vendorId,
    };
  }
}
