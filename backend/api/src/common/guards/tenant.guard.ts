import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant context on token');
    }

    // Ensure the tenantId on the route param/body matches the token
    const paramTenantId = request.params?.tenantId ?? request.body?.tenantId;
    if (paramTenantId && paramTenantId !== user.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return true;
  }
}
