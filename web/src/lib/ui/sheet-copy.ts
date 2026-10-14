import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";

export const SHEET_COPY = {
  "header.logout": { ko: "로그아웃", en: "Log out" },
  "header.farmSelect": { ko: "농장 선택", en: "Choose farm" },
  "farm.all": { ko: "전체 {count}개 농장", en: "All {count} farms" },
  "farm.live": { ko: "LIVE", en: "LIVE" },
  "farm.locationOnly": { ko: "위치만", en: "Location only" },
  "cover.stallType": { ko: "축사유형", en: "Stall type" },
  "cover.channel1": { ko: "1차", en: "1st" },
  "cover.channel2": { ko: "2차", en: "2nd" },
  "cover.channel3": { ko: "3차", en: "3rd" },
  "cover.ok": { ko: "정상", en: "Normal" },
  "cover.caution": { ko: "주의", en: "Caution" },
  "cover.warning": { ko: "경고", en: "Warning" },
  "cover.down": { ko: "두절", en: "Down" },
  "cover.danger": { ko: "위험", en: "Danger" },
  "cover.offline": { ko: "연결 끊김", en: "Offline" },
  "list.stall": { ko: "축사", en: "Stall" },
  "cover.comm": { ko: "통신", en: "Comm" },
  "cover.temp": { ko: "온도", en: "Temp" },
  "cover.humidity": { ko: "습도", en: "Humidity" },
  "chart.temp": { ko: "온도", en: "Temp" },
  "chart.humidity": { ko: "습도", en: "Humidity" },
  "chart.right": { ko: "우", en: "R" },
  "chart.motor": { ko: "모터", en: "Motor" },
  "chart.tempTrend": { ko: "온도 추세", en: "Temp trend" },
  "chart.tempSpread": { ko: "온도 산포", en: "Temp spread" },
  "chart.tempDev": { ko: "온도 편차", en: "Temp deviation" },
  "chart.humTrend": { ko: "습도 추세", en: "Humidity trend" },
  "chart.humSpread": { ko: "습도 산포", en: "Humidity spread" },
  "chart.humDev": { ko: "습도 편차", en: "Humidity deviation" },
  "chart.humHigh": { ko: "습도 상한 접촉", en: "Humidity high contact" },
  "chart.humLow": { ko: "습도 하한 접촉", en: "Humidity low contact" },
  "list.controller": { ko: "컨트롤러", en: "Controller" },
  "list.settings": { ko: "설정", en: "Settings" },
  "list.mode": { ko: "목록 보기 모드", en: "List view" },
  "list.bulk": { ko: "일괄적용", en: "Bulk apply" },
  "list.bulkStart": { ko: "일괄적용 시작", en: "Start bulk apply" },
  "list.bulkStop": { ko: "일괄적용 종료", en: "Stop bulk apply" },
  "cover.detail": { ko: "상세 보기", en: "Show detail" },
  "cover.lastReading": { ko: "마지막 측정", en: "Last reading" },
  "panel.hideDetail": { ko: "상세 숨기기", en: "Hide detail" },
  "panel.toSettings": { ko: "설정으로 전환", en: "Open settings" },
  "panel.toController": { ko: "컨트롤러로 접기", en: "Back to controller" },
  "panel.chart": { ko: "차트에서 보기", en: "View chart" },
  "panel.noReading": { ko: "{label}값 미수신", en: "No {label} reading" },
  "settings.screen": { ko: "화면", en: "Screen" },
  "settings.motor": { ko: "모터", en: "Motor" },
  "settings.cover": { ko: "덮개", en: "Cover" },
  "settings.language": { ko: "언어", en: "Language" },
  "settings.address": { ko: "주소", en: "Address" },
  "settings.light": { ko: "라이트", en: "Light" },
  "settings.dark": { ko: "다크", en: "Dark" },
  "settings.number": { ko: "숫자·단위", en: "Number" },
  "settings.bar": { ko: "막대", en: "Bar" },
  "settings.coverOn": { ko: "켜짐", en: "On" },
  "settings.coverOff": { ko: "꺼짐", en: "Off" },
  "settings.korean": { ko: "한국어", en: "한국어" },
  "settings.english": { ko: "English", en: "English" },
  "settings.alarm": { ko: "알람", en: "Alarms" },
  "settings.report": { ko: "리포트", en: "Report" },
  "settings.user": { ko: "사용자 설정", en: "Settings" },
  "alarm.toPanel": { ko: "패널로 이동", en: "Open panel" },
  "alarm.toPanelPending": { ko: "패널로 이동 중…", en: "Opening panel…" },
} as const;

export type SheetCopyKey = keyof typeof SHEET_COPY;

export const SHEET_COPY_KEYS = Object.keys(SHEET_COPY) as SheetCopyKey[];

const FIXED_LABELS: Record<string, SheetCopyKey> = {
  온도: "chart.temp",
  습도: "chart.humidity",
  "1차": "cover.channel1",
  "2차": "cover.channel2",
  "3차": "cover.channel3",
  "모터": "chart.motor",
  "온도 추세": "chart.tempTrend",
  "온도 산포": "chart.tempSpread",
  "온도 편차": "chart.tempDev",
  "습도 추세": "chart.humTrend",
  "습도 산포": "chart.humSpread",
  "습도 편차": "chart.humDev",
  "습도 상한 접촉": "chart.humHigh",
  "습도 하한 접촉": "chart.humLow",
};

export function sheetCopy(
  locale: SheetLocale,
  key: SheetCopyKey,
  vars?: Record<string, string | number>,
): string {
  let text: string = SHEET_COPY[key][locale];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}

export function translateFixedLabel(locale: SheetLocale, label: string): string {
  const key = FIXED_LABELS[label];
  return key ? sheetCopy(locale, key) : label;
}
