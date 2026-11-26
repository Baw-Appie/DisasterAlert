# 코드 컨벤션 및 SwiftLint 자동화 규칙 (CODE_CONVENTION)

> **핵심 원칙**: **"사람이 지적하지 않고 도구가 잡게 합니다."**
> iOS 클라이언트는 **`SwiftLint`**, Node.js 서버는 Linter/Formatter를 통해 스타일과 잠재적 오류를 자동 검출하여 코드 리뷰가 도메인 로직과 사용자 경험에 집중되도록 합니다.

---

## 1. 도메인 표준 용어 사전 (Ubiquitous Language)

iOS(`SwiftUI`)와 백엔드(`Node.js`) 코드, API 응답 필드, 이슈/PR 논의에서 용어 혼선을 막기 위해 아래 표준 식별자를 공통으로 사용합니다.

| 한글 용어 | 영문 표준 식별자 | 설명 및 비고 |
| :--- | :--- | :--- |
| **재난문자** | `DisasterAlert` | 재난안전데이터 공유 플랫폼에서 수집·정제된 개별 재난문자 |
| **재난 종류(유형)** | `DisasterCategory` | 태풍(`typhoon`), 호우(`heavyRain`), 화재(`fire`), 지진(`earthquake`) 등 |
| **긴급 등급** | `SeverityLevel` | 위급재난(`emergency`), 긴급재난(`urgent`), 안전안내(`safety`) |
| **대상 지역** | `TargetRegion` | 재난문자가 발송된 행정구역 (시/도, 시/군/구 단위) |
| **관심 지역** | `SubscribedRegion` | 사용자가 직접 선택한 지역 (내 거주지, 가족 거주지 등) |
| **포함 키워드** | `IncludeKeyword` | 집중해서 확인하기 위해 등록한 키워드 *(제외 키워드와 동시 매칭 시 우선 적용)* |
| **제외 키워드** | `ExcludeKeyword` | 반복되는 불필요한 문자를 걸러내기 위해 등록한 키워드 |
| **위급재난 예외 옵션** | `isEmergencyOverrideEnabled` | 위급재난 문자를 필터와 무관하게 항상 표시할지 결정하는 사용자 선택값(`Bool`) |
| **알림 필터 규칙** | `AlertFilterRule` | 관심 지역 + 포함/제외 키워드 + 위급재난 예외 옵션을 결합한 판별 규칙 |
| **현재 위치** | `CurrentLocation` | `CoreLocation` 기반으로 파악한 현 위치 및 매핑된 행정구역 |
| **검색 조건** | `AlertSearchQuery` | 과거 재난문자 검색용 복합 조건 (날짜 범위, 지역, 재난 종류, 검색어) |

---

## 2. 언어별 네이밍 컨벤션

### 2.1 iOS 클라이언트 (Swift / SwiftUI)
Apple의 [Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/)를 준수합니다.

| 대상 | 표기법 | 예시 |
| :--- | :--- | :--- |
| **`struct`, `class`, `enum`, `protocol`, SwiftUI `View`** | `PascalCase` | `DisasterAlert`, `AlertFilterService`, `AlertDetailView` |
| **변수, 프로퍼티, 함수, 메서드, `enum case`** | `camelCase` | `subscribedRegions`, `includeKeywords`, `fetchNearbyAlerts()` |
| **`Bool` 프로퍼티 및 판별 메서드** | `is`, `has`, `should`, `can` 접두사 | `isEmergencyOverrideEnabled`, `shouldDisplayAlert(_:)` |
| **Swift 파일명** | 주 타입명과 동일한 `PascalCase.swift` | `AlertFilterService.swift`, `SearchFilterView.swift` |

### 2.2 백엔드 서버 (Node.js)
| 대상 | 표기법 | 예시 |
| :--- | :--- | :--- |
| **변수, 함수, JSON 응답 키(권장)** | `camelCase` | `targetRegions`, `disasterCategory`, `parseSafetyDataRow` |
| **클래스, 타입/인터페이스** | `PascalCase` | `SafetyDataClient`, `AlertRepository` |
| **환경 변수 및 상수** | `UPPER_SNAKE_CASE` | `SAFETY_DATA_API_KEY`, `SYNC_INTERVAL_MS` |
| **서버 파일명** | `kebab-case` (단일 규칙 유지) | `safety-data.client.js`, `alerts.controller.js` |

### 공통 네이밍 금지 사항
- 의미 없는 축약어 및 모호한 이름(`data`, `info`, `temp`, `item1`, `handle()`) 사용을 금지합니다.

---

## 3. 권장 폴더 구조

클라이언트(`ios/`)와 백엔드(`server/`)를 명확히 분리하고, iOS 내부에서는 UI와 비즈니스 로직을 분리해 단위 테스트가 용이하도록 구성합니다.

```text
DisasterAlert/
├── ios/                              # iOS SwiftUI 애플리케이션
│   ├── .swiftlint.yml                # SwiftLint 규칙 설정 파일
│   ├── DisasterAlert/
│   │   ├── App/                      # 앱 진입점 (DisasterAlertApp.swift) 및 DI 구성
│   │   ├── Core/                     # 네트워크 클라이언트(APIClient), 위치 매니저(LocationManager), 확장(Extensions)
│   │   ├── Data/                     # API DTO, Repository 구현체, UserDefaults/SwiftData 로컬 저장소
│   │   ├── Domain/                   # 순수 Swift 도메인 계층 (SwiftUI 의존성 없음 — 단위 테스트 핵심 대상)
│   │   │   ├── Models/               # DisasterAlert, SubscribedRegion, AlertFilterRule 등
│   │   │   └── Services/             # 포함 우선 키워드 필터 엔진, 위급재난 예외 판별, 지역 매칭 로직
│   │   ├── Features/                 # 화면(기능) 단위 모듈 (MVVM 패턴 권장)
│   │   │   ├── Feed/                 # 맞춤 재난문자 피드 (관심 지역 + 키워드 필터 적용)
│   │   │   ├── Nearby/               # 현재 위치 기반 주변 재난문자 화면
│   │   │   ├── Search/               # 지나간 재난문자 다조건 검색 화면 (날짜·지역·종류·단어)
│   │   │   ├── Detail/               # 재난문자 상세 내용 및 대상 지역 확인 화면
│   │   │   └── Settings/             # 관심 지역, 포함·제외 키워드, 위급재난 예외 토글 설정 화면
│   │   └── Shared/                   # 공통 SwiftUI 컴포넌트 (배지, 검색바, 빈 상태/에러 뷰 등)
│   └── DisasterAlertTests/           # 도메인 필터링 및 데이터 파싱 XCTest / Swift Testing
│
└── server/                           # Node.js 백엔드 서버 (재난안전데이터 공유 플랫폼 연동)
    ├── src/
    │   ├── config/                   # 환경 변수 검증 및 설정
    │   ├── clients/                  # 재난안전데이터 공유 플랫폼 외부 API 호출 클라이언트
    │   ├── services/                 # 원본 데이터 정제(지역/재난종류 분류) 및 다조건 검색 비즈니스 로직
    │   ├── controllers/              # 요청 파라미터 검증 및 응답 직렬화
    │   └── routes/                   # REST API 라우트 (/api/alerts, /api/alerts/search 등)
    └── tests/                        # API 및 데이터 파서 테스트
```

---

## 4. 린트(SwiftLint) 및 코드 품질 자동화 규칙

### 4.1 iOS: `SwiftLint` 필수 적용
- `ios/.swiftlint.yml` 파일을 저장소에 커밋하여 두 팀원이 동일한 규칙을 사용합니다.
- **주요 강제 규칙 권장 사항**:
  - `force_unwrapping` / `force_cast`: 강제 언래핑(`!`) 및 강제 캐스팅(`as!`) 금지 → `guard let` / `if let` 안전 바인딩 사용 (런타임 크래시 방지)
  - `line_length`, `function_body_length`, `type_body_length`: 거대한 `View`나 함수 비대화 방지 (하위 SwiftUI 서브뷰로 분리 유도)
  - `unused_import`, `trailing_whitespace`: 불필요한 코드 정리
- Xcode Build Phase 스크립트 및 GitHub Actions(또는 PR 체크)에 `swiftlint --strict`를 연동하여 **경고/오류 발생 시 머지를 차단**합니다.

### 4.2 Node.js 서버: `ESLint` + `Prettier`
- `server/` 디렉터리에 `ESLint`와 `Prettier` 설정을 두고 `npm run lint` 통과를 PR 필수 조건으로 유지합니다.

---

## 5. 커밋 메시지 컨벤션

```text
<type>(#이슈번호): <50자 이내의 명확한 요약 (한글 권장, 명령조)>

- 변경 상세 내용 1
- 변경 상세 내용 2 (필요 시 결정 이유 기술)
```

| Type | 사용 시점 | 예시 |
| :--- | :--- | :--- |
| `feat` | 새로운 기능 추가 | `feat(#8): 포함 키워드 우선 적용 및 위급재난 예외 옵션 필터 구현` |
| `fix` | 버그 및 예외 수정 | `fix(#14): 위치 권한 거부 시 주변 알림 화면 무한 로딩 수정` |
| `refactor` | 기능 변화 없는 구조 개선 | `refactor(#19): 재난안전데이터 지역명 파싱 유틸 함수 분리` |
| `test` | 테스트 코드 추가/수정 | `test(#8): 포함·제외 키워드 동시 매칭 케이스 단위 테스트 추가` |
| `docs` | 문서 수정 | `docs(#2): Node.js 서버 환경 변수 및 실행 가이드 업데이트` |
| `chore` | 빌드·패키지·린트 설정 | `chore(#1): iOS 프로젝트 초기 생성 및 SwiftLint 설정 추가` |

---

## 6. 완성도를 위한 4대 예외 상태 처리 수칙

채점 기준의 **완성도(실제 사용에 문제가 없는지)** 확보를 위해 모든 SwiftUI 화면에서 아래 4가지 상태를 빠짐없이 처리합니다.

1. **로딩 상태 (`Loading`)**: API 요청 중 `ProgressView` 또는 스켈레톤 UI 제공
2. **빈 결과 상태 (`Empty`)**: 선택한 관심 지역이나 검색 조건에 해당하는 재난문자가 없을 때 명확한 안내(`ContentUnavailableView` 등) 제공
3. **위치 권한 거부 상태 (`Permission Denied`)**: `CoreLocation` 권한이 거부된 경우 크래시나 빈 화면 대신 설정 앱 이동 안내 또는 관심 지역 탭 전환 유도
4. **네트워크/서버 오류 상태 (`Error`)**: Node.js 서버 미연결 또는 공공 API 지연 시 사용자 친화적 오류 문구와 `[다시 시도]` 버튼 제공
