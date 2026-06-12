import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * Reads the tenant ID from the decoded JWT (already set by JwtAuthGuard)
 * and makes it available as request.tenantId for convenience.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request & { user?: { tenantId?: string }; tenantId?: string }, _res: Response, next: NextFunction) {
    if (req.user?.tenantId) {
      req.tenantId = req.user.tenantId;
    }
    next();
  }
}
