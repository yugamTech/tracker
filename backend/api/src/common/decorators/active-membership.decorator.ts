import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ActiveMembership } from '@saarthi/types';

export const ActiveMembershipDec = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveMembership => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return {
      personId: user.sub,
      membershipId: user.membershipId,
      tenantId: user.tenantId,
      role: user.role,
    };
  },
);
