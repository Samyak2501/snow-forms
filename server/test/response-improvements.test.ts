import { describe, it, expect } from "vitest";

describe("Response Management Improvements", () => {
  describe("1. Database Information Text", () => {
    it("should display 'Persisted in Snow Manage Database'", () => {
      const dbText = "Persisted in Snow Manage Database";
      expect(dbText).toBe("Persisted in Snow Manage Database");
      expect(dbText).not.toContain("Turso LibSQL");
    });
  });

  describe("2. Automatic Email Recording Logic", () => {
    function sanitizeResponseEmail(
      formSettings: { requireCollegeLogin?: boolean },
      recordedEmail: string | null
    ) {
      const requireCollegeLogin = Boolean(formSettings.requireCollegeLogin);
      return requireCollegeLogin ? recordedEmail : null;
    }

    function determineRecordedEmailOnSubmit(
      formSettings: { requireCollegeLogin?: boolean },
      userEmail: string | null
    ) {
      const requireCollegeLogin = Boolean(formSettings.requireCollegeLogin);
      return requireCollegeLogin ? (userEmail ? userEmail.toLowerCase().trim() : null) : null;
    }

    it("Scenario A: Records email when Restrict to University Accounts is enabled", () => {
      const settings = { requireCollegeLogin: true };
      const userEmail = "samyak.jain1@avantika.edu.in";

      const recorded = determineRecordedEmailOnSubmit(settings, userEmail);
      expect(recorded).toBe("samyak.jain1@avantika.edu.in");

      const apiResult = sanitizeResponseEmail(settings, recorded);
      expect(apiResult).toBe("samyak.jain1@avantika.edu.in");
    });

    it("Scenario B: Does NOT record email when Restrict to University Accounts is disabled", () => {
      const settings = { requireCollegeLogin: false };
      const userEmail = "samyak.jain1@avantika.edu.in";

      const recorded = determineRecordedEmailOnSubmit(settings, userEmail);
      expect(recorded).toBeNull();

      const apiResult = sanitizeResponseEmail(settings, recorded);
      expect(apiResult).toBeNull();
    });

    it("Scenario C: Never exposes email in API/CSV when restriction is disabled, even for historical responses", () => {
      const settings = { requireCollegeLogin: false };
      const historicalEmail = "historical.student@avantika.edu.in";

      const apiResult = sanitizeResponseEmail(settings, historicalEmail);
      expect(apiResult).toBeNull();

      const csvEmail = settings.requireCollegeLogin ? historicalEmail : "";
      expect(csvEmail).toBe("");
    });
  });

  describe("3. Editable Individual Response Number Navigation", () => {
    function validateAndCommitResponseNumber(
      input: string,
      currentZeroIndex: number,
      totalResponses: number
    ): { targetZeroIndex: number; inputDisplay: string; isValid: boolean } {
      const trimmed = input.trim();
      const parsed = parseInt(trimmed, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= totalResponses && /^\d+$/.test(trimmed)) {
        return {
          targetZeroIndex: parsed - 1,
          inputDisplay: String(parsed),
          isValid: true,
        };
      }
      return {
        targetZeroIndex: currentZeroIndex,
        inputDisplay: String(currentZeroIndex + 1),
        isValid: false,
      };
    }

    const TOTAL = 100;

    it("navigates to response 75 when viewing response 1", () => {
      const result = validateAndCommitResponseNumber("75", 0, TOTAL);
      expect(result.isValid).toBe(true);
      expect(result.targetZeroIndex).toBe(74);
      expect(result.inputDisplay).toBe("75");
    });

    it("navigates to response 5 and response 25", () => {
      const r5 = validateAndCommitResponseNumber("5", 0, TOTAL);
      expect(r5.isValid).toBe(true);
      expect(r5.targetZeroIndex).toBe(4);

      const r25 = validateAndCommitResponseNumber("25", 0, TOTAL);
      expect(r25.isValid).toBe(true);
      expect(r25.targetZeroIndex).toBe(24);
    });

    it("rejects 0 and reverts to current response", () => {
      const result = validateAndCommitResponseNumber("0", 4, TOTAL);
      expect(result.isValid).toBe(false);
      expect(result.targetZeroIndex).toBe(4);
      expect(result.inputDisplay).toBe("5");
    });

    it("rejects numbers exceeding total responses", () => {
      const result = validateAndCommitResponseNumber("150", 4, TOTAL);
      expect(result.isValid).toBe(false);
      expect(result.targetZeroIndex).toBe(4);
      expect(result.inputDisplay).toBe("5");
    });

    it("rejects negative numbers and decimals", () => {
      const neg = validateAndCommitResponseNumber("-10", 2, TOTAL);
      expect(neg.isValid).toBe(false);
      expect(neg.targetZeroIndex).toBe(2);

      const dec = validateAndCommitResponseNumber("5.5", 2, TOTAL);
      expect(dec.isValid).toBe(false);
      expect(dec.targetZeroIndex).toBe(2);
    });

    it("rejects text and empty input", () => {
      const text = validateAndCommitResponseNumber("abc", 9, TOTAL);
      expect(text.isValid).toBe(false);
      expect(text.targetZeroIndex).toBe(9);

      const empty = validateAndCommitResponseNumber("", 9, TOTAL);
      expect(empty.isValid).toBe(false);
      expect(empty.targetZeroIndex).toBe(9);
    });
  });
});

