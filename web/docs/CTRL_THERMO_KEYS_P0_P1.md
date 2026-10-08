# ctrl_thermo_command — P0/P1 키·인덱스 (적용)

> **적용일:** 2026-08-06 · 구 `iot-cloud` (현재 운영은 `fkkrjljeqxpbmazfnync` · 구 프로젝트 폐기)  
> **판단:** J1=A, J2=A, J3=A, J4=A, J5=DROP `idx_ctrl_thermo_command_target`, J6=A(앱 select 미변경), J7=B  
> **migration:** `supabase/migrations/20260806120000_ctrl_thermo_keys_and_indexes.sql`

## P0 생성 컬럼

| 컬럼 | 규칙 |
|------|------|
| `controller_key` | `{stall_ty}:{stall_no}:{eqpmn_no}` |
| `channel_key` | `{controller_key}\|{CHANNEL}\|{EQPMN_CODE}` · SET_CTRL은 NULL |

소스 오브 트루스 = 기존 stall/channel 컬럼. LIVE·`command_ack`와 동일 문자열.

## P1 인덱스

| 인덱스 | 용도 |
|--------|------|
| `idx_ctrl_thermo_command_sent_at` | sent 부분 · ACK/stale |
| `idx_ctrl_thermo_command_address` | 농장+실주소 이력 |
| `idx_ctrl_thermo_command_channel_key` | 채널 키 조회 |
| `idx_ctrl_thermo_command_controller_key` | 컨트롤러 키 조회 |
| ~~`idx_ctrl_thermo_command_target`~~ | **DROP** (ctrl_idx 레거시) |

## 검증 (적용 직후)

- `controller_key` NULL = 0  
- `channel_key` non-null ≈ SET_CHANNEL 건수  
- SET_CTRL → `channel_key` NULL  

## 앱 노출 (J6=B · 2026-08-06)

- `THERMO_COMMAND_SELECT`에 `controller_key`, `channel_key` 포함
- `mapThermoCommandRow`는 DB `controller_key` 우선 · `channelKey` 매핑
- Health C select·`targetLabel`에 키 우선 표시
- UI 대상 라벨에 채널 슬롯 표시 (`formatCommandTarget`)

