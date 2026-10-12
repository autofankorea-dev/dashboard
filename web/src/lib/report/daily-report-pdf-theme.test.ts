import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { DAILY_REPORT_PDF_THEME } from "./daily-report-pdf-theme";

describe("daily report pdf theme", () => {
  it("ships the letterhead band, not a red document accent", () => {
    assert.equal(DAILY_REPORT_PDF_THEME.header, "letterhead");
    assert.equal(DAILY_REPORT_PDF_THEME.footer, "bar");
    assert.equal(DAILY_REPORT_PDF_THEME.letterheadBg, "#14532D");
    assert.equal(DAILY_REPORT_PDF_THEME.tableHeadBg, "#ECFDF5");
    assert.notEqual(DAILY_REPORT_PDF_THEME.section, "#DC2626");
    assert.notEqual(DAILY_REPORT_PDF_THEME.title, "#DC2626");
  });
});
