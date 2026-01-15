/**
 * Authentication Middleware
 *
 * Verifies JWT tokens and checks admin permissions
 * - DEVELOPERS 환경변수: 쉼표로 구분된 개발자 loginid 목록 (SUPER_ADMIN 권한)
 * - DB admins 테이블: 동적으로 관리되는 관리자 목록
 */
import { Request, Response, NextFunction } from 'express';
export interface JWTPayload {
    loginid: string;
    deptname: string;
    username: string;
    iat?: number;
    exp?: number;
}
export interface AuthenticatedRequest extends Request {
    user?: JWTPayload;
    userId?: string;
    isAdmin?: boolean;
    adminRole?: 'SUPER_ADMIN' | 'SERVICE_ADMIN' | 'VIEWER' | 'SERVICE_VIEWER';
    isDeveloper?: boolean;
    adminId?: string;
}
/**
 * 개발자인지 확인 (환경변수 기반)
 */
export declare function isDeveloper(loginid: string): boolean;
/**
 * Verify JWT token and attach user to request
 */
export declare function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
/**
 * Check if user is an admin (any role)
 * 1. 환경변수 DEVELOPERS에 있으면 → SUPER_ADMIN
 * 2. DB admins 테이블에 있으면 → 해당 역할 (SUPER_ADMIN, SERVICE_ADMIN, VIEWER, SERVICE_VIEWER)
 */
export declare function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Check if user is a super admin
 * 환경변수 개발자 또는 DB SUPER_ADMIN만 허용
 */
export declare function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Sign a JWT token (for internal session management)
 */
export declare function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string;
/**
 * Verify internally signed token
 */
export declare function verifyInternalToken(token: string): JWTPayload | null;
/**
 * Check if user has write access (not VIEWER or SERVICE_VIEWER)
 * Must be used after requireAdmin middleware
 */
export declare function requireWriteAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
/**
 * Check if user has access to a specific service
 * SUPER_ADMIN/VIEWER → all services
 * SERVICE_ADMIN/SERVICE_VIEWER → only assigned services
 * Must be used after requireAdmin middleware
 */
export declare function requireServiceAccess(serviceIdParam?: string): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get list of service IDs accessible by the current admin
 * SUPER_ADMIN/VIEWER → null (all services)
 * SERVICE_ADMIN/SERVICE_VIEWER → list of assigned service IDs
 */
export declare function getAccessibleServiceIds(req: AuthenticatedRequest): Promise<string[] | null>;
//# sourceMappingURL=auth.d.ts.map