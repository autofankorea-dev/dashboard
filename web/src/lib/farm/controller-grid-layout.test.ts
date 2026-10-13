import { describe, expect, it } from "vitest";
import {
  CONTROLLER_GRID_FLAT,
  CONTROLLER_GRID_NARROW,
  FIELD_LIST_CONTAINER,
  controllerGridClass,
} from "@/lib/farm/controller-grid-layout";
import { pcWidthBand } from "@/lib/ui/layout-breakpoints";

describe("controller grid follows the list panel", () => {
  it("uses the field-list container instead of viewport 2xl", () => {
    expect(FIELD_LIST_CONTAINER).toBe("@container/field-list");
    expect(CONTROLLER_GRID_FLAT).toContain("@min-[520px]/field-list:grid-cols-2");
    expect(CONTROLLER_GRID_FLAT).toContain("@min-[960px]/field-list:grid-cols-3");
    expect(CONTROLLER_GRID_FLAT).toContain("@min-[1200px]/field-list:grid-cols-4");
    expect(CONTROLLER_GRID_FLAT).toContain("@min-[1500px]/field-list:grid-cols-5");
    expect(CONTROLLER_GRID_FLAT).not.toContain("2xl:");
  });

  it("caps the narrow grid at two columns", () => {
    expect(controllerGridClass(true, false)).toBe(CONTROLLER_GRID_NARROW);
    expect(CONTROLLER_GRID_NARROW).not.toContain("grid-cols-5");
    expect(controllerGridClass(false, true)).toBe(CONTROLLER_GRID_FLAT);
  });
});

describe("pc width bands", () => {
  it("collapses the rail below 1280 and keeps type from growing past desk", () => {
    expect(pcWidthBand(767)).toBe("narrow");
    expect(pcWidthBand(1100)).toBe("narrow");
    expect(pcWidthBand(1279)).toBe("narrow");
    expect(pcWidthBand(1280)).toBe("desk");
    expect(pcWidthBand(1919)).toBe("desk");
    expect(pcWidthBand(1920)).toBe("wide");
  });
});
