import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installArabicFormValidation } from "../src/lib/formValidation";

describe("Arabic native form errors", () => {
  let remove: () => void;
  beforeEach(() => {
    remove = installArabicFormValidation(document);
  });
  afterEach(() => {
    remove();
    document.body.replaceChildren();
  });
  it("shows Arabic for an invalid email and clears the error after a correction", () => {
    const input = document.createElement("input");
    input.type = "email";
    input.required = true;
    document.body.append(input);
    expect(input.checkValidity()).toBe(false);
    expect(input.validationMessage).toBe("يُرجى إكمال هذا الحقل.");
    input.value = "invalid-email";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(input.checkValidity()).toBe(false);
    expect(input.validationMessage).toBe("أدخل بريدًا إلكترونيًّا صالحًا.");
    input.value = "aya@example.test";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(input.checkValidity()).toBe(true);
  });
  it("explains out-of-range ayahs in Arabic rather than a browser-locale popup", () => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "64";
    input.value = "65";
    document.body.append(input);
    expect(input.checkValidity()).toBe(false);
    expect(input.validationMessage).toContain("القيمة خارج النطاق المسموح");
  });
});
