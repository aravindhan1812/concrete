import { SetMetadata } from '@nestjs/common';
import { UserKind } from '../types';

export const AUDIENCE_KEY = 'audience';

/**
 * Declares which kinds of user a route serves. Routes without it serve staff only, so an
 * external (client / vendor) login can never reach an internal endpoint by accident —
 * portal endpoints must opt in and scope their queries by `user.clientId` / `user.vendorId`.
 */
export const Audience = (...kinds: UserKind[]) => SetMetadata(AUDIENCE_KEY, kinds);
export const AnyAudience = () => Audience('staff', 'client', 'vendor');
