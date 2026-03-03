import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';

/**
 * Role-Based Access Control (RBAC) middleware factory.
 * Returns an Express middleware that allows only users with one of the specified roles.
 * Must be placed after the `authenticate` middleware in the route chain.
 *
 * @param roles - One or more allowed UserRole values
 * @example router.post('/admin-only', authorize('admin'), handler)
 * @example router.patch('/:id', authorize('agent_l1', 'agent_l2', 'admin'), handler)
 */
export function authorize(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required roles: ${roles.join(', ')}`,
      });
      return;
    }
    next();
  };
}
