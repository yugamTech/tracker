import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const isWriteOp = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (!isWriteOp) return next.handle();

    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(
          `AUDIT ${method} ${url} | actor=${req.user?.sub ?? 'anonymous'} | ${duration}ms`,
        );
      }),
    );
  }
}
