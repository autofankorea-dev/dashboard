# UI Affordance (버튼 · 표시 · 히트)

라이트/다크 공통으로 **눌러지는지**가 대기 상태에서도 보이게 한다.  
면 종류(A–H)·채도(크롬/데이터)와 **별개 축**. 새 색·글로우·H6 없음.

관련: [UI_SURFACES.md](./UI_SURFACES.md) · [UI_CHROMA.md](./UI_CHROMA.md) · [UI_VISUAL_QA.md](./UI_VISUAL_QA.md)  
코드: `dashboardAffordance` (`src/lib/ui/dashboard-page-ui.ts`)

PC(`md+`)와 모바일(컴팩트)은 **같은 계약**, 히트만 밀도 토큰으로 커진다 (`size-9`/`md:size-11`, 덮개 패딩 `p-2.5`/`sm:p-3`).

## 6종 계약

| 코드 | 이름 | 대기 시각 | 커서 | 대표 |
|------|------|-----------|------|------|
| 1 | 명령 | `--control-command` 채움 | pointer | 적용, 확인 |
| 2 | 도구 | 테두리 + `--control` tinted | pointer | 헤더, 취소, 기간, 카드 헤더 아이콘 |
| 3 | 선택군 | 트랙 + 필 `--control-active` | pointer | 뷰 탭, 목록 모드 |
| 4 | 칩 토글 | 꺼져도 테두리 + `--control` | pointer | 차트 레이어, 농장 격자 칸 |
| 5 | 히트 면 | 타일/덮개 + 코너 셰브론 | pointer | 환경 덮개, 현황 타일 |
| 6 | 잉크 | 테두리·호버 배경 없음 | default | 제목, 수치, EnvChip |

한 컨트롤은 한 계약만. `onClick`과 잉크(6)는 공존 금지.

## Do / Don't

**Do** — 표시 칩은 `metricPocket`(우물). 실사용 컨트롤은 고스트(빈 면) 금지. 대기는 `--control`. 선택은 `--control-active`. CTA는 `--control-command`(무채색 반전, 라이트는 어두운 면·다크는 밝은 면). 세그먼트 트랙만 `--surface-well`. 정상 녹색은 `--status-ok`만.  
**Don't** — 탭 solid primary, 대기 면을 `--secondary`/`--card`/`--surface-well`로만 칠하기, 수치 underline, 덮개 Dialog blur, `bg-emerald-600` 명령, 신규 글로우.

## 적용 현황 (A–G)

| 단계 | 내용 | 상태 |
|------|------|------|
| A | 이 문서 + `dashboardAffordance` | 적용 |
| B | EnvChip 우물 | 적용 |
| C | 레이어·스코프·헤더 고스트 폐기 | 적용 |
| D | 덮개·타일·명칭 셰브론 | 적용 |
| E | 뷰 탭 `choiceIdle` | 적용 |
| F | 적용/확인 primary | 적용 |
| G | `verify:ui-affordance` · Visual QA 13–18 | 적용 |
| 1-A | 허브 알람·뱃지·계정·농장전환 hue 유틸 제거 | 적용 2026-09-09 |
| control | 대기 도구 `--control` tinted (12%/22%) | 적용 2026-09-09 |

가드: `npm run verify:ui-affordance` (`verify:design`에 포함).
