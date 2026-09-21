# UI Feedback (H4 — 운영 피드백)

명령은 **접수 → 전송 → 확인** 세 단입니다 (`pending` → `sent` → `applied`). `applied`는 command_ack가 LIVE 설정과 명령을 맞춰 올린 적용 확인입니다. 설정 행·덮개 막대도 이 status를 따른다. LIVE 값이 먼저 맞아도 `sent` 폴링을 끊지 않는다(`applied`가 와야 확인단). 필드 격자에서는 해당 **환경 덮개** 값 아래에 채널별 잉크 게이지를 붙입니다.

관련: [UI_MOTION.md](./UI_MOTION.md) · [UI_CHROMA.md](./UI_CHROMA.md) · [UI_ELEVATION.md](./UI_ELEVATION.md)  
코드: `src/lib/ui/ops-feedback.ts` · `src/lib/farm/apply-queue.ts` · `controller-env-cover.tsx` · `command-pipeline-overlay.tsx` · `command-confirm-overlay.tsx` · `inline-status-toast.tsx`

## 톤 (`opsFeedbackTone`)

| tone | 용도 | 색 |
|------|------|---|
| `ok` | 적용 성공 | `--status-ok` |
| `warn` | 부분 실패 · 주의 | `--status-warn` |
| `error` | 실패 | `--status-danger` (`--destructive` 별칭) |
| `info` | 안내 | border + foreground |
| `loading` | 적용 중 | muted + spin |

셸: `opsFeedbackShell` (= elevation float급 `shadow-lg`).

## 명령 파이프라인 모션

| phase | 모션 |
|-------|------|
| loading | 오버레이 fade |
| success / error | `.ui-motion-feedback-icon` soft scale-in (amplitude 토큰) |

필드 **환경 덮개**는 명령을 보내지 않은 칸에는 스트립을 그리지 않는다. 최근 1시간 접수·전송·확인 티켓이 있는 컨트롤러만 값·알람 띠 아래에 채널 A/B/C 행을 올린다. **설정 패널**에서는 보낸 채널 한눈 줄이 같은 세 단으로 차고, 확인 때 체크가 잠깐 보인다. 설정은 접지 않는다. **축사·컨트롤러·채널당 가장 최근 1건**만 큐에 남긴다. 1시간이 지나면 티켓을 내린다. 좌하단 상주 도크와 와이어 헥스는 운영 화면에 두지 않는다. 델린은 오른쪽 아래.

## 적용 큐 (필드 덮개)

| 화면 단계 | 의미 |
|-----------|------|
| 접수 | 대기열 등록 |
| 전송 | 현장 송신 (`sent`) |
| 확인 | 적용 확인 (`applied`) |

게이지는 덮개 잉크(`currentColor`)와 투명도만 쓴다. 3단 채움은 `scaleX` + `duration-motion-moderate`로 이어 간다. 오른쪽은 로딩 도넛, `applied`면 체크 후 `exit`로 해당 행을 내린다.

설정 한눈 줄은 행 자체가 막대다. `primary` 면을 왼쪽부터 채우고, 확인이면 체크를 `enterFade`로 보여 준 뒤 같은 `emphasis` 유지·`exit`로 색과 체크를 내린다. 가운데 적용 완료 카드는 명령 진행 중에는 쓰지 않는다.

## 명령 설정 범위 (컨트롤러 · 온도·모터 겹침)

큐(덮개 스트립)는 **최근 1시간**의 접수·전송·확인이다. 차트 「명령」 토글은 **command 테이블이 아니라** 추이 RPC(decoded 설정 시계열)로 A/B/C 창을 그린다. 명령 행은 변경 순간만 알려 주고, 그 시간대의 설정온도·편차·환기는 decoded 버킷 값이다. 기본은 끔. 온도 본선은 실선, 온·습 상·하한은 채널 색 점선이며 우측 숫자 호버 시 하이라이트(강조선)를 켠다. 설정 이력은 `--channel-fan-exhaust`(보라) 한 색으로, A 투명 실선 · B 투명 점선 · C 투명 이중점선이다. A·B·C 구간은 같은 투명 창을 두고, 겹친 구간은 합성으로 진해진다. 접촉·초과 코리도는 그리지 않는다.

| 축 | 의미 |
|----|------|
| 가로 | 통합 추이와 같은 시각 |
| 온도 세로 | 실측 온도와 같은 ℃ (설정온도~편차. 축을 늘리지 않음) |
| 모터 세로 | 실측 모터와 같은 환기% (최저~최고환기. 축을 늘리지 않음) |

같은 decoded 설정이 이어지는 동안 온도 띠와 모터 띠를 **유지**한다. 온도·모터를 한 밴드로 겹쳐 보면 온도 창만 그린다. 그래프 아래 A·B·C 아이콘으로 채널별 겹침을 켜고 끈다.

**상호작용 (온·습·모터와 동일 계약)**

- **탭/클릭** → 데이터 카드 **고정**(홀드). 유지띠와 카드는 **점선**으로 이어집니다.
- **같은 띠 재클릭** · 카드 닫기 · 차트 밖 클릭 → 해제.
- **호버** → 임시 카드(이미 핀된 띠는 호버 카드 숨김).
- **드래그** → 위 측정 추이와 **같은 시간 구간**을 확대합니다. 측정 Y밴드(온도·습도·모터)는 바꾸지 않습니다.
- **URL** `chartCmd=1`: 온도·모터 본선에 명령 이력 켬. 옛 `chartYBand`의 `command`는 같은 의미로 읽습니다.

설정온도·편차·환기 요약을 카드에 둔다. 값은 decoded RPC 시계열이다. 접수·전송·실패·취소 티켓은 차트에 그리지 않는다.

점·+N 클러스터·임의 duration 없음. 필드 덮개 적용 스트립은 차트와 달리 **덮개 잉크만** 쓰고 채널·상태 hue를 올리지 않는다.

코드: `src/lib/farm/channel-thermo.ts` · `decoded-setting-hold.ts` · `command-hold-bands.ts` · `trend-chart-event-lane.tsx` · `use-trend-scope-gesture.ts`

## 컴포넌트

| UI | 레이어 |
|----|--------|
| `CommandPipelineOverlay` | FEEDBACK_Z.overlay |
| `CommandConfirmOverlay` | overlay — 전송 전 승인(자동 닫힘 없음) |
| `ControllerEnvCover` 채널 스트립 | 필드 칸 — 적용 중인 컨트롤러만 |
| `InlineStatusToast` | toast |

## reduced-motion / CI

- CSS reduce: toast · command-overlay/card · feedback-icon
- 로컬: `npm run audit:motion-reduced`
- CI(런타임 강제): `npm run audit:motion-reduced:ci`  
  (`--strict` → BASE 필수, 실패 시 exit 1). 또는 `STRICT_MOTION_RUNTIME=1`.

## Do / Don't

**Do** — 상태 변화에만 모션 · 공통 `ops-feedback` 톤 · 적용 큐는 정식 명칭만  
**Don't** — 토스트마다 다른 border 색 · success에 spring overshoot · `applied` 전 「적용 완료」
