/**
 * Request Logger Middleware
 *
 * 모든 API 호출의 헤더 정보를 디코딩하여 구조화된 로그로 출력
 * docker compose logs로 확인 가능
 */

import { Request, Response, NextFunction } from 'express';

/**
 * URL 인코딩된 텍스트 안전하게 디코딩
 */
function safeDecode(value: string | undefined): string {
  if (!value) return '';
  try {
    if (value.includes('%')) {
      return decodeURIComponent(value);
    }
    return value;
  } catch {
    return value;
  }
}

/**
 * Authorization 헤더에서 사용자 정보 추출
 */
function decodeAuthHeader(authHeader: string | undefined): Record<string, unknown> | null {
  if (!authHeader) return null;

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // SSO token (sso.base64data)
  if (token.startsWith('sso.')) {
    try {
      const binaryString = Buffer.from(token.substring(4), 'base64').toString('binary');
      const jsonString = decodeURIComponent(
        binaryString.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      const payload = JSON.parse(jsonString);
      return { type: 'sso', loginid: payload.loginid, username: payload.username, deptname: payload.deptname };
    } catch {
      return { type: 'sso', error: 'decode_failed' };
    }
  }

  // JWT token (xxx.yyy.zzz)
  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const payloadBase64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
      return {
        type: 'jwt',
        loginid: payload.loginid || payload.sub || '',
        username: payload.username || payload.name || '',
        deptname: payload.deptname || payload.department || '',
        exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
      };
    } catch {
      return { type: 'jwt', error: 'decode_failed' };
    }
  }

  return { type: 'unknown' };
}

/**
 * 요청/응답 로깅 미들웨어
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // 헤더 디코딩
  const serviceId = (req.headers['x-service-id'] as string) || '';
  const userId = (req.headers['x-user-id'] as string) || '';
  const userName = safeDecode(req.headers['x-user-name'] as string);
  const userDept = safeDecode(req.headers['x-user-dept'] as string);
  const authInfo = decodeAuthHeader(req.headers['authorization'] as string);

  // 요청 body에서 모델/스트림 정보 추출 (POST /v1/chat/completions)
  const model = req.body?.model || '';
  const stream = req.body?.stream || false;

  // 응답 완료 시 로그 출력
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;

    const logData: Record<string, unknown> = {
      method: req.method,
      path: req.originalUrl || req.url,
      status,
      duration: `${duration}ms`,
      ip: req.ip || req.headers['x-forwarded-for'] || '',
    };

    if (serviceId) logData.serviceId = serviceId;
    if (userId) logData.userId = userId;
    if (userName) logData.userName = userName;
    if (userDept) logData.userDept = userDept;
    if (model) logData.model = model;
    if (stream) logData.stream = stream;
    if (authInfo) logData.auth = authInfo;

    // 상태코드별 로그 레벨 구분
    const prefix = '[Request]';
    const logLine = `${prefix} ${req.method} ${req.originalUrl || req.url} ${status} ${duration}ms` +
      (serviceId ? ` | service=${serviceId}` : '') +
      (userId ? ` | user=${userId}` : '') +
      (userName ? ` | name=${userName}` : '') +
      (userDept ? ` | dept=${userDept}` : '') +
      (model ? ` | model=${model}` : '') +
      (stream ? ` | stream=${stream}` : '') +
      (authInfo ? ` | auth=${authInfo.type}(${authInfo.loginid || ''})` : '');

    if (status >= 500) {
      console.error(logLine);
    } else if (status >= 400) {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }
  });

  next();
}
