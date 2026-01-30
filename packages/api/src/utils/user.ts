/**
 * User utility functions (shared across proxy, service, activity routes)
 */

import { Request } from 'express';
import { prisma } from '../index.js';

const DEFAULT_USER = {
  loginid: 'anonymous',
  username: 'Anonymous User',
  deptname: 'Unknown',
};

/**
 * deptname에서 사업부 추출
 * "팀이름(사업부)" → 사업부, "사업부/팀이름" → 사업부
 */
export function extractBusinessUnit(deptname: string): string {
  if (!deptname) return '';
  const match = deptname.match(/\(([^)]+)\)/);
  if (match) return match[1];
  const parts = deptname.split('/');
  return parts[0]?.trim() || '';
}

/**
 * URL 인코딩된 텍스트 디코딩 (한글 등)
 * 디코딩 실패 시 원본 반환
 */
export function safeDecodeURIComponent(text: string): string {
  if (!text) return text;
  try {
    if (!text.includes('%')) return text;
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * 사용자 조회 또는 생성 (upsert)
 * X-User-Id 헤더가 있으면 해당 사용자, 없으면 기본 사용자
 */
export async function getOrCreateUser(req: Request) {
  const loginid = (req.headers['x-user-id'] as string) || DEFAULT_USER.loginid;
  const username = safeDecodeURIComponent((req.headers['x-user-name'] as string) || DEFAULT_USER.username);
  const deptname = safeDecodeURIComponent((req.headers['x-user-dept'] as string) || DEFAULT_USER.deptname);
  const businessUnit = extractBusinessUnit(deptname);

  const user = await prisma.user.upsert({
    where: { loginid },
    update: {
      lastActive: new Date(),
      deptname,
      businessUnit,
    },
    create: {
      loginid,
      username,
      deptname,
      businessUnit,
    },
  });

  return user;
}
