# LIVE HOT View 규칙 (thin list)

Sprint C · 대시보드 읽기 규율. Free tier · Micro에서는 **HOT list 뷰를 얇게** 유지한다.

## 계층

| 객체 | 용도 | 허용 |
| --- | --- | --- |
| `v_iot_dashboard_list` | 카드·목록·soft refresh·Admin hub overview | 평면 컬럼만 (온·습·팬·thermo 스칼라). 최근 14일 키 + LATERAL 최신 1행 |
| `v_iot_decoded_latest` | 패널 bootstrap · 채널 벌크 · enrich | `decoded_json` → channels[]. 동일 14일 키 + LATERAL |
| `v_iot_farm_overview` | Admin hub 집계 | list 위 집계만. LIVE 전체 DISTINCT ON 금지 |
| `farm_trend_history*` | 차트 WARM | RPC · View에 이력 스캔 넣지 않음 |

코드 정본: [`src/lib/domain/live-read-select.ts`](../src/lib/domain/live-read-select.ts) · 호출 계약: [`live-config.ts`](../src/lib/domain/live-config.ts) · 성능: [`PERF_BASELINE.md`](./PERF_BASELINE.md).

## 금지 (list)

- `decoded_json`, `channels` (및 동등 JSON/배열 페이로드)
- 다테이블 조인으로 list를 “풀 패널”로 키우기
- soft refresh를 full(`decoded_latest`)로 되돌리기
- 물리 테이블을 View로 치환해 “디스크 절약” 위장 (읽기 경로와 무관·위험)
- LIVE 전체 이력 `DISTINCT ON` (12만+ 행 스캔 → statement timeout)

컨트롤러 키는 `received_at > now() - 14 days` 에서만 찾는다. 오프라인 판정은 1시간. **1시간을 넘긴 무수신 컨트롤러는 14일 창 안에서 offline으로 목록·개요에 남는다. 14일을 넘기면 빠진다.**

## PR 체크리스트 (View / LIVE SELECT 변경 시)

- [ ] list SELECT에 `LIVE_LIST_FORBIDDEN_TOKENS` 없음 (`npm test` · `live-read-select.test.ts`)
- [ ] 새 컬럼이 카드/목록에만 필요하면 list · 채널·명령이면 decoded_latest
- [ ] `npm run measure:live` — farm-scoped list p95 &lt; 300 ms
- [ ] soft refresh 후 벌크/채널 적용: channels merge 또는 enrich 가드 유지
- [ ] migration은 **사용자 승인 후**만 (운영 DB)

## 롤백

- 앱: `NEXT_PUBLIC_LIVE_READ_TIER=legacy`
- View: migration revert (승인 후)
