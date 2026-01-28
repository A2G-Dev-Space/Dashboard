# API Reference

AIPO for Web API는 RESTful 방식으로 설계되었습니다.

## Base URL

```
https://a2g.samsungds.net:16002/api
```

## 인증

모든 API 요청에는 JWT 토큰이 필요합니다.

```bash
Authorization: Bearer {token}
```

### 토큰 획득

SSO 로그인 후 `/auth/login` 엔드포인트에서 토큰을 받습니다.

---

## Auth API

### POST /auth/login

SSO 토큰으로 로그인하여 세션 토큰을 발급받습니다.

**Request:**
```bash
curl -X POST "https://a2g.samsungds.net:16002/api/auth/login" \
  -H "Authorization: Bearer {sso-token}"
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "clxxx...",
    "loginid": "user.name",
    "username": "홍길동",
    "deptname": "AI플랫폼팀(DS부문)",
    "businessUnit": "DS부문"
  },
  "spaces": {
    "personalSpaceId": "clxxx...",
    "teamSpaceId": "clxxx...",
    "teamId": "clxxx..."
  },
  "sessionToken": "eyJhbG...",
  "isSuperAdmin": false,
  "isTeamAdmin": false
}
```

### GET /auth/me

현재 로그인한 사용자 정보를 조회합니다.

### POST /auth/refresh

세션 토큰을 갱신합니다.

### POST /auth/logout

로그아웃합니다.

---

## Spaces API

### GET /spaces/personal

개인 공간 정보를 조회합니다.

### GET /spaces/team

팀 공간 정보를 조회합니다.

### GET /spaces/:id/tree

공간의 폴더/파일 트리 구조를 조회합니다.

**Query Parameters:**
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| language | string | KO | 언어 (KO, EN, CN) |

**Response:**
```json
{
  "spaceId": "clxxx...",
  "type": "PERSONAL",
  "tree": [
    {
      "id": "clxxx...",
      "name": "회의록",
      "path": "/회의록",
      "type": "folder",
      "children": [
        {
          "id": "clxxx...",
          "name": "2024-01 마케팅 전략.md",
          "path": "/회의록/2024-01 마케팅 전략.md",
          "type": "file",
          "hasKO": true,
          "hasEN": true,
          "hasCN": false
        }
      ]
    }
  ],
  "stats": {
    "folderCount": 5,
    "fileCount": 12
  }
}
```

### GET /spaces/:id/summary

공간 요약 정보를 조회합니다 (홈 화면용).

---

## Files API

### GET /files/:id

노트 상세 정보를 조회합니다.

**Query Parameters:**
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| language | string | KO | 언어 (KO, EN, CN) |

**Response:**
```json
{
  "file": {
    "id": "clxxx...",
    "name": "2024-01 마케팅 전략",
    "path": "/회의록/2024-01 마케팅 전략.md",
    "commentCount": 3
  },
  "version": {
    "id": "clxxx...",
    "language": "KO",
    "content": "[{\"type\":\"heading\",...}]"
  },
  "availableLanguages": [
    { "language": "KO", "updatedAt": "2024-01-20T..." },
    { "language": "EN", "updatedAt": "2024-01-20T..." }
  ]
}
```

### GET /files/:id/history

노트 변경 이력을 조회합니다.

### POST /files/:id/export

마크다운으로 내보냅니다.

**Request Body:**
```json
{
  "language": "KO",
  "includeComments": true
}
```

### POST /files/:id/share

공유 링크를 생성합니다.

### POST /files/:id/retry-translation/:lang

번역을 재시도합니다.

---

## Requests API

### POST /requests/input

노트 작성 요청을 생성합니다.

**Request Body:**
```json
{
  "spaceId": "clxxx...",
  "input": "오늘 회의 내용을 정리해줘. 참석자는..."
}
```

**Response:**
```json
{
  "request": {
    "id": "clxxx...",
    "status": "PENDING",
    "position": 1
  }
}
```

### POST /requests/search

검색 요청을 생성합니다.

**Request Body:**
```json
{
  "spaceId": "clxxx...",
  "query": "지난주 마케팅 회의 내용"
}
```

### POST /requests/refactor

폴더 구조 재정리를 요청합니다 (관리자 전용).

### GET /requests/:id

요청 상태를 조회합니다.

### DELETE /requests/:id

요청을 취소합니다.

---

## Comments API

### GET /comments/files/:fileId/comments

파일의 모든 댓글을 조회합니다.

**Response:**
```json
{
  "comments": {
    "block-id-1": [
      {
        "id": "clxxx...",
        "blockId": "block-id-1",
        "content": "이 부분 검토 필요합니다.",
        "user": {
          "username": "홍길동"
        },
        "createdAt": "2024-01-20T...",
        "replies": [...]
      }
    ]
  },
  "totalCount": 5
}
```

### POST /comments/files/:fileId/comments

댓글을 작성합니다.

**Request Body:**
```json
{
  "blockId": "block-id-1",
  "content": "검토 완료했습니다.",
  "parentId": null
}
```

### PUT /comments/:id

댓글을 수정합니다.

### DELETE /comments/:id

댓글을 삭제합니다.

---

## Trash API

### GET /trash

휴지통 목록을 조회합니다.

**Query Parameters:**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|-----|------|
| spaceId | string | ✅ | 공간 ID |

### POST /trash/:id/restore

휴지통에서 복원합니다.

### DELETE /trash/:id

영구 삭제합니다 (관리자 전용).

### DELETE /trash

휴지통을 비웁니다 (관리자 전용).

---

## Admin API

### GET /admin/teams

전체 팀 목록을 조회합니다 (Super Admin).

### POST /admin/teams/:teamId/admins

팀 관리자를 추가합니다 (Super Admin).

### DELETE /admin/teams/:teamId/admins/:userId

팀 관리자를 제거합니다 (Super Admin).

### GET /admin/stats

시스템 통계를 조회합니다.

### GET /admin/audit-logs

감사 로그를 조회합니다.

**Query Parameters:**
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| page | number | 1 | 페이지 번호 |
| limit | number | 50 | 페이지당 개수 |
| action | string | - | 필터: 액션 타입 |
| spaceId | string | - | 필터: 공간 ID |

---

## WebSocket Events

### 연결

```javascript
import { io } from 'socket.io-client';

const socket = io('https://a2g.samsungds.net:16002', {
  path: '/ws',
  auth: { token: 'your-jwt-token' }
});
```

### 이벤트

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| subscribe:request | Client → Server | 요청 상태 구독 |
| queue:update | Server → Client | 큐 상태 업데이트 |
| request:progress | Server → Client | 처리 진행률 |
| request:complete | Server → Client | 처리 완료 |
| request:failed | Server → Client | 처리 실패 |

---

## Rate Limiting

| 엔드포인트 | 제한 |
|------------|------|
| POST /requests/input | 분당 5회 |
| POST /requests/search | 분당 10회 |
| 기타 | 제한 없음 |

## 에러 응답

```json
{
  "error": "Error message"
}
```

| 상태 코드 | 설명 |
|----------|------|
| 400 | Bad Request - 잘못된 요청 |
| 401 | Unauthorized - 인증 필요 |
| 403 | Forbidden - 권한 없음 |
| 404 | Not Found - 리소스 없음 |
| 429 | Too Many Requests - Rate Limit 초과 |
| 500 | Internal Server Error - 서버 오류 |
