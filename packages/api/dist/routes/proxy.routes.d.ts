/**
 * LLM Proxy Routes
 *
 * Proxies /v1/* requests to actual LLM endpoints
 * 폐쇄망 환경: 인증 없이 사용 가능
 * Usage tracking: LLM 응답에서 토큰 사용량 추출하여 DB에 저장
 */
export declare const proxyRoutes: import("express-serve-static-core").Router;
//# sourceMappingURL=proxy.routes.d.ts.map