# DisasterAlert Server (`server/`)

Fastify + SQLite(`node:sqlite`) + HTTP/2 APNs(`sandbox` / `production`, Critical Alert 지원) 기반 디바이스 등록 및 재난 푸시 발송 서버입니다.

## 요구 사항

- **Node.js**: `>= 22.5.0` (권장: Node.js 24 LTS)
- 외부 공개 시 반드시 **HTTPS 리버스 프록시** 뒤에 배치하세요 (`TRUST_PROXY=true`).

## 환경 변수

```bash
export APNS_TEAM_ID=YOUR_TEAM_ID
export APNS_KEY_ID=YOUR_KEY_ID
export APNS_TOPIC=com.example.app
export APNS_PRIVATE_KEY_PATH=/run/secrets/AuthKey_YOUR_KEY_ID.p8
export APNS_ENVIRONMENT=production
export HOST=0.0.0.0
export PORT=3000
export DATABASE_PATH=/var/lib/DisasterAlert/devices.sqlite
export TRUST_PROXY=true
export TEST_PUSH_API_KEY=REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS
```

## 실행 및 검증

```bash
cd server
npm install

# 개발 실행 (파일 변경 감지, 로컬 테스트 시 DATABASE_PATH=./data/devices.sqlite 권장)
DATABASE_PATH=./data/devices.sqlite npm run dev

# 프로덕션 실행
npm start

# ESLint + Prettier 검사
npm run lint

# 단위 및 통합 테스트
npm test
```

## 제공 API 요약

| 메서드 & 경로           | 설명                                                 | 제한 및 인증                                                |
| :---------------------- | :--------------------------------------------------- | :---------------------------------------------------------- |
| `PUT /v1/devices`       | APNs 디바이스 등록 또는 설정 갱신 (`204 No Content`) | 본문 최대 8KB, IP당 분당 60회 (`DELETE`와 합산)             |
| `DELETE /v1/devices`    | APNs 디바이스 등록 해제 (`204 No Content`, 멱등)     | 본문 최대 8KB, IP당 분당 60회 (`PUT`과 합산)                |
| `POST /v1/devices/test` | 등록된 특정 디바이스로 APNs 연결 확인 테스트 발송    | `Bearer <TEST_PUSH_API_KEY>`, 본문 최대 8KB, IP당 분당 10회 |
| `GET /health`           | 서버 및 SQLite 상태 확인 (`200 OK`)                  | 인증 없음                                                   |
