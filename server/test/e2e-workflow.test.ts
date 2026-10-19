import { db, schema } from "../src/db/index.js";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const BASE = "http://localhost:4000";

async function runE2ETest() {
  console.log("=============================================================");
  console.log("       AU FORMS END-TO-END SYSTEM INTEGRATION TEST           ");
  console.log("=============================================================");

  // 1. Non-college domain rejection test
  console.log("\n1. Testing security domain restriction (@avantika.edu.in)...");
  const badDomainRes = await fetch(`${BASE}/api/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "unauthorized@gmail.com", name: "Hacker" }),
  });
  const badDomainJson = await badDomainRes.json();
  if (badDomainRes.status === 400 && badDomainJson.error.includes("avantika.edu.in")) {
    console.log("✓ Correctly rejected non-campus email domain:", badDomainJson.error);
  } else {
    throw new Error("Failed to reject non-campus email domain: " + JSON.stringify(badDomainJson));
  }

  // 2. College email OTP request test
  const testEmail = `e2e.student.${Date.now()}@avantika.edu.in`;
  console.log(`\n2. Requesting OTP for campus email: ${testEmail}...`);
  const otpRes = await fetch(`${BASE}/api/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, name: "Avantika Test Student", purpose: "signup" }),
  });
  const otpJson = await otpRes.json();
  if (!otpRes.ok) {
    throw new Error("Failed to request OTP: " + JSON.stringify(otpJson));
  }
  console.log("✓ OTP requested successfully:", otpJson.message);

  // Retrieve the generated OTP record from database
  const otpRecord = await db
    .select()
    .from(schema.otpVerification)
    .where(eq(schema.otpVerification.email, testEmail))
    .limit(1);

  if (otpRecord.length === 0) {
    throw new Error("OTP record was not persisted to Turso database!");
  }
  console.log("✓ OTP record found in Turso database with SHA-256 hash:", otpRecord[0].otpHash.slice(0, 16) + "...");

  // 3. Test incorrect OTP rejection
  console.log("\n3. Testing incorrect OTP code rejection...");
  const wrongOtpRes = await fetch(`${BASE}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, code: "000000", purpose: "signup" }),
  });
  const wrongOtpJson = await wrongOtpRes.json();
  if (wrongOtpRes.status === 400 && wrongOtpJson.error.includes("Incorrect")) {
    console.log("✓ Incorrect code rejected with security message:", wrongOtpJson.error);
  } else {
    throw new Error("Failed to reject invalid OTP: " + JSON.stringify(wrongOtpJson));
  }

  // Calculate actual 6-digit code or bypass test verification by finding code
  // In our test, let's find the matching code from 100000 to 999999 by comparing hash
  console.log("\n4. Resolving valid OTP code from hash for automated verification test...");
  const crypto = await import("crypto");
  let validCode = "";
  for (let i = 100000; i <= 999999; i++) {
    const candidate = i.toString();
    const candidateHash = crypto
      .createHash("sha256")
      .update(`${candidate}:${testEmail}:${process.env.BETTER_AUTH_SECRET || "salt"}`)
      .digest("hex");
    if (candidateHash === otpRecord[0].otpHash) {
      validCode = candidate;
      break;
    }
  }

  if (!validCode) throw new Error("Could not compute valid OTP code");
  console.log("✓ Matched 6-digit OTP code securely:", validCode);

  // Verify valid OTP
  const verifyRes = await fetch(`${BASE}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, code: validCode, purpose: "signup" }),
  });
  const verifyJson = await verifyRes.json();
  if (!verifyRes.ok || !verifyJson.tempToken) {
    throw new Error("Failed to verify valid OTP: " + JSON.stringify(verifyJson));
  }
  console.log("✓ OTP verified successfully! Temp Token issued:", verifyJson.tempToken.slice(0, 10) + "...");

  // 5. Finalize password and create user account
  console.log("\n5. Setting password and creating verified user account...");
  const setPassRes = await fetch(`${BASE}/api/auth/otp/set-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      tempToken: verifyJson.tempToken,
      password: "AvantikaSecurePassword2026!",
      name: "Avantika Test Student",
    }),
  });
  const setPassJson = await setPassRes.json();
  if (!setPassRes.ok) {
    throw new Error("Failed to set password: " + JSON.stringify(setPassJson));
  }
  const setCookie = setPassRes.headers.get("set-cookie") || "";
  console.log("✓ Account created and verified in Turso! User:", setPassJson.user.name, setPassJson.user.email);
  console.log("✓ Session cookie issued:", setCookie ? setCookie.split(";")[0] : "(none)");

  // Extract session cookie for subsequent authenticated requests
  const sessionCookie = setCookie.split(";")[0];

  // 6. Test Form Creation
  console.log("\n6. Creating an AU Form with Quiz Mode...");
  const createFormRes = await fetch(`${BASE}/api/forms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      title: "Avantika Tech & Design Quiz 2026",
      description: "Official Campus Assessment on HCI and Full-Stack Architecture",
      isQuiz: true,
    }),
  });
  const createFormJson = await createFormRes.json();
  if (!createFormRes.ok) {
    throw new Error("Failed to create form: " + JSON.stringify(createFormJson));
  }
  const formId = createFormJson.id;
  const publicId = createFormJson.publicId;
  console.log("✓ Form created in Turso! Form ID:", formId, "Public ID:", publicId);

  // 7. Update Form layout with questions, quiz points, and answer keys
  console.log("\n7. Saving full form layout with all question types and quiz keys...");
  const secId1 = crypto.randomUUID();
  const secId2 = crypto.randomUUID();
  const q1Id = crypto.randomUUID(); // multiple choice
  const q2Id = crypto.randomUUID(); // checkboxes
  const q3Id = crypto.randomUUID(); // linear scale

  const layoutPayload = {
    sections: [
      { id: secId1, title: "Section 1: General Knowledge", orderIndex: 0 },
      { id: secId2, title: "Section 2: Design & Systems", orderIndex: 1 },
    ],
    elements: [
      {
        id: q1Id,
        sectionId: secId1,
        orderIndex: 0,
        type: "multiple_choice",
        title: "Where is Avantika University located?",
        isRequired: true,
        points: 5,
        options: JSON.stringify([
          { id: "opt_1", text: "Ujjain, Madhya Pradesh" },
          { id: "opt_2", text: "Bhopal, Madhya Pradesh" },
          { id: "opt_3", text: "Indore, Madhya Pradesh" },
        ]),
        quizAnswerKey: JSON.stringify({
          correctAnswers: ["Ujjain, Madhya Pradesh"],
          feedbackCorrect: "Correct! Avantika University is in Ujjain.",
        }),
      },
      {
        id: q2Id,
        sectionId: secId1,
        orderIndex: 1,
        type: "checkboxes",
        title: "Select Avantika University's Core Disciplines:",
        isRequired: true,
        points: 5,
        options: JSON.stringify([
          { id: "opt_c1", text: "Design" },
          { id: "opt_c2", text: "Technology" },
          { id: "opt_c3", text: "Submarine Navigation" },
        ]),
        quizAnswerKey: JSON.stringify({
          correctAnswers: ["Design", "Technology"],
        }),
      },
      {
        id: q3Id,
        sectionId: secId2,
        orderIndex: 0,
        type: "linear_scale",
        title: "Rate your overall campus experience (1-5):",
        isRequired: true,
        points: 0,
        scaleSettings: JSON.stringify({
          min: 1,
          max: 5,
          minLabel: "Needs Improvement",
          maxLabel: "Outstanding",
        }),
      },
    ],
  };

  const layoutRes = await fetch(`${BASE}/api/forms/${formId}/layout`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify(layoutPayload),
  });
  if (!layoutRes.ok) throw new Error("Failed to save layout");
  console.log("✓ Form layout saved with 2 sections and 3 questions!");

  // 8. Publish the Form
  console.log("\n8. Publishing form for public access...");
  await fetch(`${BASE}/api/forms/${formId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ status: "published" }),
  });
  console.log("✓ Form published successfully!");

  // 9. Public Form Retrieval & Answer Key Sanitization Check
  console.log("\n9. Testing public form retrieval & security sanitization...");
  const pubRes = await fetch(`${BASE}/api/public/forms/${publicId}`);
  const pubJson = await pubRes.json();
  if (!pubRes.ok) throw new Error("Failed to fetch public form: " + JSON.stringify(pubJson));

  // Security check: Verify quizAnswerKey is NOT exposed to respondent
  const exposedKey = pubJson.elements.some((el: any) => el.quizAnswerKey !== undefined);
  if (exposedKey) {
    throw new Error("SECURITY BREACH: quizAnswerKey was exposed in public response!");
  }
  console.log("✓ Public form retrieved safely! quizAnswerKey is securely stripped.");

  // 10. Submit Public Response (Anonymous respondent with no login)
  console.log("\n10. Submitting response as public respondent...");
  const submitRes = await fetch(`${BASE}/api/public/forms/${publicId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      respondentEmail: "student.respondent@avantika.edu.in",
      answers: {
        [q1Id]: "Ujjain, Madhya Pradesh", // 5 pts (correct)
        [q2Id]: ["Design", "Technology"], // 5 pts (correct)
        [q3Id]: "5",
      },
    }),
  });
  const submitJson = await submitRes.json();
  if (!submitRes.ok) throw new Error("Submission failed: " + JSON.stringify(submitJson));
  console.log("✓ Response submitted successfully!");
  console.log("✓ Quiz Auto-Score:", submitJson.score);

  if (submitJson.score.totalScore !== 10) {
    throw new Error(`Expected score 10, got ${submitJson.score.totalScore}`);
  }
  console.log("✓ Objective auto-grading verified! Awarded 10/10 points.");

  // 11. Fetch Responses and CSV Export
  console.log("\n11. Testing Response retrieval & CSV export...");
  const csvRes = await fetch(`${BASE}/api/forms/${formId}/export/csv`, {
    headers: { Cookie: sessionCookie },
  });
  const csvText = await csvRes.text();
  if (!csvRes.ok || !csvText.includes("Ujjain, Madhya Pradesh")) {
    throw new Error("Failed to export valid CSV data: " + csvText);
  }
  console.log("✓ CSV Export verified with persisted response data!");
  console.log("CSV Preview (first 2 lines):\n", csvText.split("\n").slice(0, 2).join("\n"));

  // 12. Test Form Closure and Deadline enforcement
  console.log("\n12. Closing form and verifying submission rejection...");
  await fetch(`${BASE}/api/forms/${formId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ status: "closed" }),
  });

  const rejectedSubmitRes = await fetch(`${BASE}/api/public/forms/${publicId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      answers: { [q1Id]: "Ujjain, Madhya Pradesh" },
    }),
  });
  const rejectedSubmitJson = await rejectedSubmitRes.json();
  if (rejectedSubmitRes.status === 400 && rejectedSubmitJson.error.includes("closed")) {
    console.log("✓ Closed form correctly rejected submission:", rejectedSubmitJson.error);
  } else {
    throw new Error("Failed to reject submission on closed form");
  }

  // 13. Clean up test records
  console.log("\n13. Cleaning up test data in Turso database...");
  await db.delete(schema.forms).where(eq(schema.forms.id, formId));
  await db.delete(schema.user).where(eq(schema.user.email, testEmail));
  await db.delete(schema.otpVerification).where(eq(schema.otpVerification.email, testEmail));
  console.log("✓ Cleaned up test form and user records.");

  console.log("\n=============================================================");
  console.log("🎉 ALL END-TO-END TESTS PASSED WITH 100% SUCCESS!");
  console.log("=============================================================");
}

runE2ETest().catch((err) => {
  console.error("\n❌ E2E Test FAILED:", err);
  process.exit(1);
});
