# UI 검증

다크 가시성, 수동 시각 QA, Health 스모크 기록, 모바일 audit.


---

## 다크 가시성

## 다크모드 가시성 — 현황 · 개선 계획

> **역할:** 유지보수 계획 (H6 아님). 구현은 **사용자 승인 후**.  
> **관련:** [`UI.md`](./UI.md#면) · [`UI.md`](./UI.md#단) · [`UI.md`](./UI.md#채도) · [`UI_QA.md`](./UI_QA.md)  
> **조사일:** 2026-09-09 · **구현:** P0–P6 적용 (같은 날) · 라이브 다크 스크린샷은 검증 단계에서 보완

다크모드는 갭5로 **면(바탕·카드·우물)** 은 나눴다. 글자·테두리·끊김·데이터 혼합은 라이트 공식(검정 잉크, 흰 혼합, 동일 상태 hex)이 남아 대비가 무너진다.

---

### 1. 목표

1. **데이터가 먼저 읽힌다.** 주의·위험·끊김 숫자와 덮개 판정이 다크에서도 본문만큼 보인다.
2. **칸이 보인다.** 격자 타일·우물이 서로 구분된다.
3. **라이트는 그대로.** `.dark` 토큰·다크 전용 클래스만 손댄다. 새 글로우·H6 없음.
4. **잉크는 깔개에 맞춘다.** 덮개(밝은 상태 면) 위 글자와 타일(어두운 카드) 위 글자를 나눈다.

성공: 필드 컴팩트·덮개 연 타일·차트 추세선·끊김 덮개가 다크에서 라이트와 같은 판독 순서로 읽힌다.

---

### 2. 현황 (조사)

#### 2.1 토큰 — 갭5가 한 일 / 안 한 일

| 토큰 | 라이트 | 다크 | 가시성 |
|------|--------|------|--------|
| `--background` | L 0.958 | L 0.145 | 바탕 OK |
| `--card` | L 0.995 | L 0.218 | 층은 있음, 그림자 없음 |
| `--muted` | L 0.935 | L 0.172 | 우물·워시. 바탕과 가깝음 |
| `--secondary` | muted 90% + fg | 같은 공식 (다크에서 카드보다 약간 밝음) | 회색 뱃지 면. muted와 분리 |
| `--control` | primary 12% + secondary | 같은 믹스 상속 | 대기 버튼 tinted. 우물·카드와 구분 |
| `--control-active` | primary 22% + secondary | 같은 믹스 상속 | 켜진 탭 칸·도구 |
| `--foreground` | L 0.22 | L 0.95 | 본문 OK |
| `--muted-foreground` | L 0.45 | L 0.64 | 보조 글자 OK (갭5에서 눈부심↓) |
| `--tertiary-foreground` | muted 70% + bg | 같은 공식 | 플레이스홀더·힌트 (iOS tertiaryLabel) |
| `--quaternary-foreground` | muted 42% + bg | 같은 공식 | 장식 화살표 (iOS quaternaryLabel) |
| `--border` | L 0.82 | L 0.275 | 칸 경계 약함 (비문자 3:1 미달 추정) |
| `--surface-ring` | 전경 12% | 전경 8% | 타일 링 더 약함 |
| `--surface-shadow-tile` | 있음 | `none` | 깊이는 명도만 |
| `--channel-*` | 중명도 | L ≈ 0.68–0.72 | 차트·정상 숫자 OK |
| `--status-ok\|warn\|danger` | 고정 hex | **명도만 재계산** (hue/chroma 유지) | 정상 덮개 창백·주의 형광 완화. 잉크는 `*-ink` / on-canvas |
| `--destructive` | `var(--status-danger)` | 상속 | 폼·삭제 = 위험 상태와 동일 (systemRed) |
| `--status-*-ink` | 상태색 36–40% + **검정** | **동일 공식** | 덮개 OK, 타일 실패 |
| `--status-film-rim-*` | 흰/검 줄 | 동일 | 다크 덮개 테는 약함 |

`verify:ui-colors`는 sky/rose hex 회귀만 본다. **대비 가드는 없다.** `UI_VISUAL_QA` 체크리스트 다크 칸은 비어 있다.

#### 2.2 핵심 실패 — 잉크를 깔개와 반대로 씀

`--status-*-ink`는 덮개(E)용이다. “면과 같은 색상각, 더 진함. 흰/검정 잉크 없음.” (`controller-env-cover.ts`)

같은 클래스를 **어두운 타일 숫자**에도 쓴다.

```
controllerEnvMetricTextClass(warn|danger) → status-*-ink (검정 혼합)
```

대략 L(잉크) ≈ 0.23, L(카드) ≈ 0.22 → 숫자와 깔개가 같다.

| 자리 | 깔개 | 글자 | 다크 결과 |
|------|------|------|-----------|
| 덮개 E (닫힘) | `--status-*` 솔리드 | `*-ink` 검정 혼합 | **읽힘** (밝은 면 + 진한 글자) |
| 컴팩트 현황 칸 | 상태색 14–18% 틴트 (`ENV_SURFACE`) | 같은 `*-ink` | **안 읽힘** |
| 덮개 연 타일 | `bg-card` | 같은 `*-ink` | **안 읽힘** |
| 차트 커버리지 라벨 | 플롯 배경 | `status-warn-ink` / `danger-ink` | **안 읽힘** |
| 연결 끊김 덮개 | `bg-muted` | `muted-foreground` | **면이 우물에 녹음** |

단위 `℃` `%`에 `opacity-70`이 한 겹 더 있어 컴팩트 칸은 더 죽는다.

#### 2.3 화면별

**필드**

- 덮개 닫힘: 정상=`#6f9e8a` 솔리드 → 다크에서 창백한 섬. 주의·위험은 노랑·빨강이라 판정은 보임.
- 덮개 끊김: `bg-muted` ≈ 우물.
- 컴팩트 현황(`farm-map-card` `ENV_SURFACE`): 틴트 약함 + 검정 잉크. **주 사용 격자에서 가장 심각.**
- 레거시 `STATUS_SURFACE` / `STATUS_ACCENT`: `emerald`/`amber`/`red` + 다크 글로우. 토큰 밖.

**차트**

- 본선 `--channel-*`: 다크 명도 상향 → 읽힘.
- 선 글로우 `.dark` opacity 0.12→0.28 → 번질 수 있음.
- EMA 장기: `channel` + **검정** (`EMA_LONG_COLOR`, `HUM_EMA_LONG_COLOR`) → 다크에서 선이 배경으로 붙음.
- EMA 단기·편차 위: `channel` + **흰색** → 창백.
- 설정온도 밴드: `channel-temp` + 흰색 (`controller-summary-gauge-parts`, 투어 가이드).
- 커버리지 라벨: `*-ink` (위 표).
- 알람 점선: `--status-warn` → 보임.
- SVG `rgb(14 165 233)` 잔존(차트 가이드 일부) — 다크에서는 오히려 보이나 채널 토큰 위반.

**알림 · 델린**

- 헤더 종·델린 숫자 뱃지: 주의/위험 솔리드 + `text-white` → 대비 OK.
- 델린 말풍선 목록: `muted-foreground` → 본문보다 약하지만 읽힘.
- 헤더 알람 버튼: `--status-danger` 틴트 (`topHeaderActionBtnAlert`).

**관제 지도**

- 카카오 타일: 항상 밝은 지도. 셸만 다크.
- 핀: 라이브 `#10b981`(가드 금지 hex와 동일 계열), 끊김=`muted-foreground`.
- 평면 구간 라벨: `plan-cover-*` 70% + **검정** (`farm-map-controller-detail`) → 다크 카드 위 실패 가능.
- 히트맵: 정상/이력 opacity 0.18 → 다크에서 거의 없음. 주의·경고 0.9 + 고정 hex → 섬처럼 뜸. 이력 `#94a3b8` 비토큰.

**오버레이 · 로그인**

- 명령 확인 카드: `bg-background/95` + `shadow-xl` (단 3는 허용 범위 근처). 가시성 OK.
- 로그인 오류/안내: amber/red 950 틴트는 다크 대응됨.
- body: `dark:bg-background` (라이트는 `muted/30`).

#### 2.4 잘 되는 것 (건드리지 않음)

- 본문·제목 `foreground`
- 보조 설명 `muted-foreground` (메타·축 숫자 — 커버리지 라벨 제외)
- 채널 시리즈 본선, 정상 타일의 채널 숫자
- 브랜드 `primary` (다크 L 0.723)
- 델린/알림 **솔리드 뱃지 + 흰 숫자**

#### 2.5 조사 한계

- Production 다크 **로그인 후 스크린샷 없음.** 대비 수치는 oklch L 근사.
- EC2/현장과 무관. 테마는 기기 로컬(`dashboard-theme.ts`).

---

### 3. 설계 결정 (구현 전 고정)

| 결정 | 내용 | 하지 않는 것 |
|------|------|----------------|
| **잉크 2종** | 덮개 위=`*-ink`(진함). 타일·차트 위=`*-on-canvas`(다크는 상태색 또는 흰 혼합) | 덮개에 흰 글자 전면 도입 |
| **상태 hex** | 라이트 솔리드 hex 유지. 다크는 같은 색상각·채도에서 L만 재계산 | 다크에서 덮개를 우물색으로 흐리기 · hue를 primary/채널에 붙이기 |
| **끊김** | 중성 면 토큰 신설 (`--status-offline` 또는 well+강한 링) | 끊김을 danger 빨강으로 칠하기 |
| **혼합 기준** | `white`/`black` 리터럴 대신 `--mix-lift` / `--mix-shade` (테마가 가리킴) | 차트마다 다른 다크 예외 |
| **지도** | 후순위. 카카오 다크 타일은 제품 결정 | P0에 지도 SDK 테마 |
| **문법** | 기존 `--status-*` / `--channel-*` / 면 A–H | 신규 글로우·무한 펄스·H6 |

---

### 4. 단계 계획

#### P0 — 타일·차트 잉크 (필수)

**목적:** 주의·위험 숫자가 다크 카드에서 읽히게.

| 항목 | 내용 |
|------|------|
| 파일 | `globals.css` `.dark` · `controller-env-cover.ts` · `trend-chart.tsx` · `controller-env-cover.test.ts` |
| 신규 토큰 | `--status-ok-on-canvas` 등. 라이트=기존 ink 또는 상태색. 다크=`--status-*` 또는 상태+foreground 혼합 |
| 로직 | `controllerEnvMetricTextClass`는 on-canvas. `controllerEnvCoverInkClass`는 덮개 전용 ink 유지 |
| 차트 | 커버리지 라벨을 on-canvas / muted-foreground로 |
| 영향 | 필드 컴팩트·덮개 연 타일·차트 라벨. 덮개 닫힘 글자는 유지 |
| 테스트 | 단위: 클래스 문자열이 on-canvas. `verify:design`. 수동: 다크 필드 주의 칸 숫자 |
| 롤백 | 토큰·클래스 매핑 되돌리기 |

#### P1 — 끊김 면

**목적:** 통신 두절 덮개·컴팩트 칸이 우물에 안 녹게.

| 항목 | 내용 |
|------|------|
| 파일 | `globals.css` · `controller-env-cover.tsx` (`COVER_FILL` offline) · `farm-map-card.tsx` (`ENV_SURFACE` offline) |
| 안 | `--status-offline` = muted-foreground 18% + 전경 링 20%, 글자=`foreground` 또는 `muted-foreground` L↑ |
| 금지 | 끊김을 `--status-danger`로 통일 |
| 테스트 | 덮개 라벨 「연결 끊김」 대비. 라이트 회귀 |
| 롤백 | `bg-muted` 복귀 |

#### P2 — 칸 경계

**목적:** 격자·우물이 손으로 세지 않아도 나뉘게.

| 항목 | 내용 |
|------|------|
| 파일 | `globals.css` `.dark` `--border` · `--surface-ring` · (선택) `--surface-well-border` |
| 범위 | L(border) 상향, ring 8%→약 14%. **shadow 재도입 없음** (갭5 유지) |
| 테스트 | `verify:ui-elevation`. 다크 필드 격자 스크린 |
| 롤백 | 기존 L 0.275 / 8% |

#### P3 — 흰·검 혼합 데이터

**목적:** 게이지 밴드·EMA가 다크에서 창백/소멸하지 않게.

| 항목 | 내용 |
|------|------|
| 파일 | `globals.css` `--mix-lift` `--mix-shade` · `unified-barn-trend-series.ts` · `controller-summary-gauge-parts.tsx` · `tour-guides.tsx` · `farm-map-controller-detail.ts` |
| 공식 | 라이트 lift=white, shade=black. 다크 lift=`foreground` 또는 card, shade=`background` |
| 차트 글로우 | `.dark .farm-chart-line-glow` 0.28 → 0.16 전후 (번짐만) |
| 테스트 | 차트 장기 추세선이 본선과 구분·소멸하지 않음 |
| 롤백 | 리터럴 white/black 혼합 복귀 |

#### P4 — 크롬 잔여 색 (가시성 + 문법)

**목적:** `emerald`/`red` 유틸을 status/primary로. 다크 분기가 한곳으로.

| 항목 | 내용 |
|------|------|
| 파일 | `farm-map-card.tsx` STATUS_* · `dashboard-page-ui.ts` 알람 버튼 · 히트맵 칩 · bulk-apply 피드백 (범위는 PR 단위로 쪼갬) |
| 히트맵 | 정상 opacity 다크만 소폭↑. 이력 hex → 토큰 |
| 제외 | 카카오 브랜드 `#FEE500` allowlist |
| 테스트 | `verify:ui-colors` |

#### P5 — 지도 (후순위 · 별도 승인)

카카오 다크 맵타입·오버레이 대비. 핀 `#10b981` → `--primary` 또는 `--status-ok`. P0–P3과 묶지 않음.

#### P6 — 검증을 문에 넣기

| 항목 | 내용 |
|------|------|
| `UI_QA.md` | 다크 행: 컴팩트 주의 숫자, 끊김 덮개, 차트 EMA, 격자 경계 |
| (선택) | 토큰 L 최소차 스크립트 — 신규 의존 없이 `globals.css` 파싱만 |
| 수동 | 필드 / 차트 / 알림·델린 / 로그인 · compact+comfortable |

---

### 5. 영향 · 하지 말 것

| 영향 | 내용 |
|------|------|
| DB / API / 인증 / 배포 | 없음 |
| 라이트 | P0–P2는 `.dark`·다크 클래스 위주. P3 mix 토큰은 라이트 기본값을 현재와 같게 |
| Profile 테마 동기 | 없음 (승인 전 금지) |
| 델린 프로토콜 | 문구·JUDGE 없음. 뱃지 흰 숫자는 유지 |

하지 말 것: 신규 글로우, 덮개 Glass 서리, 타일 shadow-lg, 상태색을 sky/rose로, 라이트 ink 공식 파괴.

---

### 6. 승인 후 진행 순서

1. P0만 브랜치 `fix/dark-status-on-canvas`
2. `npm test` (cover 단위) · `npm run verify:design` · 다크 필드 수동
3. 결과 보고 후 P1–P2
4. P3–P4는 별 PR
5. P5는 지도 승인 후

배포: 기존과 같이 commit → push → main. **이 문서만으로는 배포하지 않음.**

---

### 7. 적용 현황 (2026-09-09)

| 단계 | 상태 |
|------|------|
| P0 on-canvas 잉크 | 적용. 덮개 `*-ink` 유지 |
| P1 끊김 면 | 적용. `--status-offline` · 디밍 제거 |
| P2 border/ring | 적용. 다크 border L 0.36 · ring 14% |
| P3 mix-lift/shade | 적용. EMA·게이지·plan-cover |
| P4 크롬 잔여 | 적용. 현황 링·헤더 알람·히트맵 칩·차트 가이드 색 |
| P5 지도 | 적용. 핀 `--primary` · 타일 img 밝기 필터 (카카오 다크 맵타입 없음) |
| P6 가드 | 적용. `verify-ui-colors` `.dark` 토큰 · Visual QA 7–12행 |
| 다크 상태 명도 | 적용. `.dark` `--status-ok\|warn\|danger` = oklch (L만). 라이트 hex 유지 |
| Label 3·4단 | 적용. `--tertiary-foreground` · `--quaternary-foreground` (muted+bg mix). 본문/보조는 유지 |
| muted vs secondary | 적용. `--secondary` = muted 90%+foreground. `.dark`에서 복제 hex/oklch 없음 |
| systemRed 단일 | 적용. `--destructive: var(--status-danger)`. 폼 invalid·삭제가 덮개 위험색과 같음 |
| 1-A 허브 hue | 적용. 알람=`--status-danger` · 위치만=`channel-info` · 리포트=우물 |
| control tinted | 적용. 대기 `--control` 12% · 켜짐 `--control-active` 22%. `.dark` oklch 복제 없음 |

가드: `node scripts/verify-ui-colors.mjs` 가 `.dark`의 on-canvas·offline·mix·heatmap 토큰, 상태색 oklch(비-hex), Label 3·4단, `--secondary`≠`--muted`, `--destructive`=`--status-danger`, `--control` tinted 믹스를 확인한다.


---

## 시각 QA

## UI Visual QA (수동)

기준일: 2026-07-30 · 대상: `dashboard/web` 농장 허브

### 판정

**아직 고급스럽지 않음.**  
토큰·가드·H1–H5는 “시스템 1.0”이지만, 화면 인상은 운영 도구에 가깝고 브랜드·면·리듬의 고급감은 부족하다.

### 체크리스트 (로컬)

| # | 화면 | 확인 | 결과 |
|---|------|------|------|
| 1 | 로그인 brand 스플래시 | presence(~1.2s)로 과도하게 길지 않은지 | |
| 2 | 그리드/목록 | 크롬 채도 낮음 · 숫자·알람만 선명 | |
| 3 | 차트 | spring/과한 scale 없음 · 채널색 일관 | |
| 4 | 컨트롤러 카드 | 온도=`channel-temp` · 설정밴드=`channel-info` · warn=`amber/status` | |
| 5 | 옛 `view=aria` | 필드로 열림. 뱃지·스테이지·도크 없음 | |
| 7 | **다크** 필드 컴팩트 | 주의·위험 숫자가 카드에서 읽힘 (on-canvas, 덮개 ink 아님) | |
| 8 | **다크** 끊김 덮개 | 우물에 안 녹음 · 글자 foreground | |
| 9 | **다크** 격자 경계 | border/ring으로 칸이 나뉨 | |
| 10 | **다크** 차트 EMA·밴드 | 장기 추세가 배경에 붙지 않음 · 설정밴드가 창백하지 않음 | |
| 11 | **다크** 알림 | 솔리드+숫자 대비 유지. 델린 뱃지는 없음 | |
| 12 | **다크** 지도 타일 | 타일 img 밝기↓ · 핀은 primary/status (카카오 다크 맵타입 없음) | |
| 13 | **라이트/다크 · PC/모바일** 온·습 칩 | 테두리 없는 우물. 아웃라인 버튼처럼 안 보임 | |
| 14 | **라이트/다크 · PC/모바일** 환경 덮개 | 상태색 유지 · 코너 셰브론으로 열기 힌트. 다크 정상=세이지가 창백 섬이 아님 · 주의가 형광으로 안 뜸 | |
| 15 | **라이트/다크 · PC/모바일** 뷰 탭 비활성 | 설명 글자가 아님. 필은 활성만 | |
| 16 | **라이트/다크** 차트 레이어 꺼짐 | 테두리 유지. 장식 아이콘 아님 | |
| 17 | **라이트/다크 · PC/모바일** 적용/확인 | primary 채움. 취소는 테두리 | |
| 18 | **모바일** 히트 | 덮개·현황·탭 최소 높이가 손가락 히트에 맞음 | |
| 19 | **라이트/다크** 입력 힌트 | 플레이스홀더가 본문·보조 설명보다 한 단 약함 (tertiary). 빈 상태 문구는 muted 유지 | |

### 고급감 갭 (후속 후보)

1. **면·여백** — **갭1 적용** (`dashboardHubSurface`: well → tile → metricPocket · 그리드/목록 간격↑).
2. **타이포 리듬** — **갭2 적용** (`dashboardReadout` · 숫자/단위/라벨 분리). **맵 카드는 `--density-map-value*` 고정** (readout 재사용 회귀 금지 · `verify:ui-density`).
3. **채도 잔향** — violet/온도 orange는 제거·가드됨. 구역별 톤이 다시 섞이면 재스캔.
4. **DELIN 뱃지** — 제거됨. 필드에 뱃지·오브·스테이지를 두지 않음.
5. **다크/라이트 비대칭** — **갭5 적용** (`--surface-*`). **P0–P6 적용** 2026-09-09: 타일 on-canvas 잉크 · 끊김 면 · border/ring · mix-lift/shade · 크롬 잔여 · 지도 타일 필터. **다크 상태 명도** · **Label 3·4단** · **muted≠secondary** · **destructive=status-danger** 2026-09-09. 정본 [`UI_QA.md`](./UI_QA.md).

6. **면 종류** — [UI.md](./UI.md#면). 덮개는 Status film(E). 유리 테 적용. Overlay(F) frost와 섞지 않음.
7. **어포던스** — [UI.md](./UI.md#어포던스) A–G 적용(2026-09-09). 표시 칩=우물 · 덮개 셰브론 · 탭 choiceIdle · CTA primary.

→ 신규 H6는 **승인 전 착수 금지**. 갭은 이 문서에만 누적.

### 동결과의 관계

시스템 토큰·가드는 동결(`UI_MOTION` · design-animation-agent).  
고급화는 “새 이펙트 추가”가 아니라 위 갭을 **승인된 소단위**로만 줄인다.


---

## Health·명령 스모크

## UI 스모크 — Health C / 명령 이력 (2026-08-06)

> **환경:** `localhost:3000` (로그인된 관리자 세션) · DB는 당시 구 `iot-cloud`  
> **현재 운영 DB:** `fkkrjljeqxpbmazfnync` · 구 `iot-cloud` **폐기**  
> **Prod URL:** 별도 로그인 미실시 · Vercel이 `main`(`8eb322a`) 배포 후 동일 기대

### 체크 결과

| # | 항목 | 결과 |
|---|------|------|
| 1 | 명령 이력 최상단 | **11:30 · 적용 완료** · `FARM01 · 자돈사 · 축사 01 · 06번 · A` (스모크 `farm01_ops_smoke_20260806`) |
| 2 | 채널 라벨 | 대상에 **· A** 표시 (J6 `formatCommandTarget`) |
| 3 | Health C | DAG **C 명령 · 정상** · `24h 실패 0` · checkpoint 0 |
| 4 | sent stuck | UI상 실패/stuck 없음 (DB sent=0과 정합) |
| 5 | 외부 연계 | **미구현** (EKAPE WAITING과 정합) |
| 6 | FARM02 모듈 | S1 장애(수신 정지) — **HW 테스트용 · 조치 범위 밖** |

### 비고

- 로컬 Next hydration: `HealthRefreshBar` ARIA/title 시계·카운트다운을 마운트 후로 지연 · `formatKst`를 formatToParts 고정 조립으로 맞춤 (2026-08-06)
- Health lane에 raw `channel_key` 문자열(`SP05:01:06|A|EC03`)은 사용자 표시명 대신 정식 명칭 경로를 씀 (의도)


---

## 모바일 audit

## 모바일 UI Audit (`mobile-ui-audit.mjs`)

375×812 뷰포트에서 **admin / operator / viewer** 주요 경로의 레이아웃·터치 타겟을 자동 검수합니다.

### 실행

```bash
cd dashboard/web
npm run dev   # http://localhost:3000
node scripts/mobile-ui-audit.mjs
```

환경 변수:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `UI_VERIFY_BASE` | `http://localhost:3000` | 대시보드 베이스 URL |

테스트 계정 비밀번호 (`scripts/test-accounts.mjs`):

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| admin | `admin@test.com` | `admin1` |
| operator | `farmer@test.com` | `farmer` |
| viewer | `viewer@test.com` | `viewer` |

audit 실행 전 `npm run set:test-passwords`로 Supabase에 반영할 수 있습니다 (service role 필요).

### 산출물

`scripts/mobile-audit-output/`

- `report.json` — 페이지별 이슈·메트릭
- `*.png` — 역할·경로별 스크린샷

### 검수 기준 (휴리스틱)

| 코드 | 심각도 | 조건 | 허용 기준 |
|------|--------|------|-----------|
| `HORIZONTAL_OVERFLOW` | high | 문서 가로 스크롤 > viewport | **0건** |
| `TEXT_CLIPPED` | medium | 버튼·라벨 등 3건+ 잘림 | **0건** (또는 2건 이하) |
| `TABLE_OVERFLOW` | medium | 테이블이 viewport보다 넓음 | **0건** |
| `OVERSIZED_TEXT` | medium | 24px+ 텍스트 노드 8건 초과 | 역할·페이지별 문맥 검토 |
| `OVERSIZED_BUTTONS` | low | 본문 버튼 높이 ≥56px **또는** 글자 ≥20px, 라벨 1~24자, **4건 이상** | **0건** (clean 목표) |

#### 제외 영역 (오탐 방지)

- **Shell**: `header`, `운영 탭`, `모니터링 탭` 등 — 44px+ 터치 타겟 허용
- **지도**: Leaflet 컨트롤 (`.leaflet-control`, `.leaflet-bar`)
- **Farm map 리스트**: `[data-audit-region="farm-map-list"]`

#### 모바일 compact 대상 (참고)

- 알람 strip (`ops-mobile-alarm-strip`, `density=compact`)
- Health DAG 리스트 (`health-dag-mobile-list`, `HealthStatusBadge compact`)
- 채널 설정 3버튼 (`ChannelSettingsBar compact`)
- Admin 축사유형 그리드 (`ops-mobile-sp-overview`)

### 합격 판정

- **Release gate**: `issueCount === 0` 인 페이지 비율 = **100%** (현재 25경로)
- `low` 이슈는 터치 UX 개선용; high/medium은 배포 전 해소 권장

### 관련 스크립트

- `ui-route-verify.mjs` — 데스크톱·라우트 HTTP/렌더 스모크 (모바일 레이아웃 미포함)
