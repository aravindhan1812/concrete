import { SetMetadata } from '@nestjs/common';
export const PERMISSIONS_KEY = 'requiredPermissions';
/** Require ANY of the listed permission codes. */
export const RequirePermissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);
