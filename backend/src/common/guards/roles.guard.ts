import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const hasRole = user && user.role && requiredRoles.includes(user.role);
    try {
      require('fs').appendFileSync('roles_guard_debug.log', JSON.stringify({
        method: request.method,
        url: request.url,
        requiredRoles,
        userRole: user?.role,
        hasRole
      }) + '\\n');
    } catch(e) {}
    return hasRole;
  }
}

