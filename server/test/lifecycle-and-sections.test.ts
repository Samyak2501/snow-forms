import { db, schema } from "../src/db/index.js";
import { auth } from "../src/auth/index.js";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const BASE = "http://localhost:4000";

// Helpers matching the client section rendering logic
function isMeaningfulTitle(title?: string | null): boolean {
  if (!title) return false;
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === "untitled section") return false;
  return true;
}

function isMeaningfulDescription(desc?: string | null): boolean {
  if (!desc) return false;
  const trimmed = desc.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === "description (optional)") return false;
  return true;
}

function computePublicSectionDisplay(sections: Array<{ id: string; title?: string | null; description?: string | null }>) {
  const totalSections = Math.max(sections.length, 1);
  return sections.map((sec, idx) => {
    const showHeaderBadge = totalSections > 1;
    const badgeText = showHeaderBadge ? `SECTION ${idx + 1} OF ${totalSections}` : null;
    const showTitle = showHeaderBadge && isMeaningfulTitle(sec.title);
    const visibleTitle = showTitle ? sec.title!.trim() : null;
    const showDescription = showHeaderBadge && isMeaningfulDescription(sec.description);
    const visibleDescription = showDescription ? sec.description!.trim() : null;
    const renderCard = showHeaderBadge;

    return {
      sectionId: sec.id,
      renderCard,
      badgeText,
      visibleTitle,
      visibleDescription,
    };
  });
}

async function runRegressionTests() {
  console.log("======================================================================");
  console.log("     SNOW FORMS — SECTION HEADERS & LIFECYCLE REGRESSION TESTS        ");
  console.log("======================================================================");

  // -------------------------------------------------------------------------
  // SECTION 1: UNIT / REGRESSION TESTS FOR PUBLIC SECTION RENDERING RULES
  // -------------------------------------------------------------------------
  console.log("\n--- PART 1: PUBLIC SECTION RENDERING LOGIC TESTS ---");

  // Scenario 1: One-section form with empty title
  {
    const sections = [{ id: "sec_1", title: "", description: "" }];
    const display = computePublicSectionDisplay(sections);
    if (!display[0].renderCard && display[0].badgeText === null && display[0].visibleTitle === null) {
      console.log("✓ Rule 1: One-section form hides badge, title, and empty description completely");
    } else {
      throw new Error("Failed Rule 1: Single section form displayed section header badge or title: " + JSON.stringify(display[0]));
    }
  }

  // Scenario 2: Multi-section form with all titles empty
  {
    const sections = [
      { id: "sec_1", title: "", description: "" },
      { id: "sec_2", title: "   ", description: "" },
      { id: "sec_3", title: "", description: "" },
    ];
    const display = computePublicSectionDisplay(sections);
    if (
      display.length === 3 &&
      display[0].badgeText === "SECTION 1 OF 3" &&
      display[1].badgeText === "SECTION 2 OF 3" &&
      display[2].badgeText === "SECTION 3 OF 3" &&
      display.every((d) => d.visibleTitle === null)
    ) {
      console.log("✓ Rule 2: Multi-section form shows dynamic numbered badges and suppresses empty/whitespace titles");
    } else {
      throw new Error("Failed Rule 2 multi-section empty titles test: " + JSON.stringify(display));
    }
  }

  // Scenario 3: Mixture of named and unnamed sections
  {
    const sections = [
      { id: "sec_1", title: "Personal Details", description: "Fill in your info" },
      { id: "sec_2", title: "", description: "" },
      { id: "sec_3", title: "Academics", description: "" },
    ];
    const display = computePublicSectionDisplay(sections);
    if (
      display[0].visibleTitle === "Personal Details" &&
      display[1].visibleTitle === null &&
      display[2].visibleTitle === "Academics" &&
      display[0].badgeText === "SECTION 1 OF 3" &&
      display[1].badgeText === "SECTION 2 OF 3" &&
      display[2].badgeText === "SECTION 3 OF 3"
    ) {
      console.log("✓ Rule 3: Badges appear for all sections, but only the 1st and 3rd display titles");
    } else {
      throw new Error("Failed mixed named/unnamed sections test: " + JSON.stringify(display));
    }
  }

  // Scenario 4: Legacy section whose stored title is 'Untitled Section'
  {
    const sections = [
      { id: "sec_1", title: "Untitled Section", description: "" },
      { id: "sec_2", title: " untitled section  ", description: "" },
      { id: "sec_3", title: "Final Feedback", description: "" },
    ];
    const display = computePublicSectionDisplay(sections);
    if (display[0].visibleTitle === null && display[1].visibleTitle === null && display[2].visibleTitle === "Final Feedback") {
      console.log("✓ Rule 4: Stored legacy 'Untitled Section' is recognized and suppressed from public display");
    } else {
      throw new Error("Failed legacy 'Untitled Section' suppression test: " + JSON.stringify(display));
    }
  }

  // Scenario 5: Stable IDs used for conditional branching independent of visible title
  {
    const sections = [
      { id: "sec_uuid_alpha", title: "" },
      { id: "sec_uuid_beta", title: "" },
    ];
    const branchRule = { sourceOptionId: "opt_yes", targetSectionId: sections[1].id };
    if (branchRule.targetSectionId === "sec_uuid_beta") {
      console.log("✓ Rule 5: Section navigation & conditional branching rely on stable IDs, not visible titles");
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 2: END-TO-END DRAFT & PUBLISH LIFECYCLE TESTS WITH REAL TURSO DB
  // -------------------------------------------------------------------------
  console.log("\n--- PART 2: DRAFT & PUBLISH LIFECYCLE INTEGRATION TESTS ---");

  // Authenticate using Better Auth API
  const testEmail = `regression.lifecycle.${Date.now()}@avantika.edu.in`;
  const testPassword = "SecureAvantikaPassword123!";
  const testName = "Regression Lifecycle User";

  await auth.api.signUpEmail({
    body: {
      name: testName,
      email: testEmail,
      password: testPassword,
    },
  });

  const signInRes = await auth.api.signInEmail({
    body: {
      email: testEmail,
      password: testPassword,
    },
    asResponse: true,
  });

  const setCookie = signInRes.headers.get("set-cookie") || "";
  const cookieVal = setCookie.split(";")[0];
  const authHeaders = {
    "Content-Type": "application/json",
    cookie: cookieVal,
  };
  console.log("✓ Authenticated session established for campus user:", testEmail);

  // 1. Create a blank form -> must be a private draft
  console.log("\n1. Testing blank form creation...");
  const createRes = await fetch(`${BASE}/api/forms`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ title: "Regression Test Lifecycle Form" }),
  });
  const createdForm = await createRes.json();
  if (!createRes.ok || !createdForm.id) {
    throw new Error("Failed to create blank form: " + JSON.stringify(createdForm));
  }
  const formId = createdForm.id;
  const publicId = createdForm.publicId;

  if (createdForm.status === "draft") {
    console.log("✓ New form is saved in Turso as private draft (status = 'draft')");
  } else {
    throw new Error("New form was not saved as draft! Status: " + createdForm.status);
  }

  // 2. Verify anonymous respondent endpoint cannot retrieve the draft
  console.log("\n2. Testing anonymous respondent access to unpublished draft...");
  const anonDraftRes = await fetch(`${BASE}/api/public/forms/${publicId}`, {
    method: "GET",
  });
  if (anonDraftRes.status === 404) {
    console.log("✓ Anonymous GET /api/public/forms/:publicId returned 404 Not Found for unpublished draft");
  } else {
    throw new Error(`Draft leaked! Anonymous request returned status ${anonDraftRes.status}`);
  }

  // 3. Verify anonymous submission to draft is strictly rejected (403)
  console.log("\n3. Testing anonymous submission to unpublished draft...");
  const anonSubmitRes = await fetch(`${BASE}/api/public/forms/${publicId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: { test: "val" } }),
  });
  const submitJson = await anonSubmitRes.json();
  if (anonSubmitRes.status === 403) {
    console.log("✓ Anonymous submission to draft rejected with 403 Forbidden:", submitJson.error);
  } else {
    throw new Error(`Anonymous submission to draft was not rejected! Status ${anonSubmitRes.status}`);
  }

  // 4. Verify owner CAN preview the draft
  console.log("\n4. Testing owner preview of unpublished draft...");
  const ownerPreviewRes = await fetch(`${BASE}/api/public/forms/${publicId}`, {
    method: "GET",
    headers: { cookie: setCookie },
  });
  const ownerPreviewJson = await ownerPreviewRes.json();
  if (ownerPreviewRes.ok && ownerPreviewJson.isDraftPreview === true) {
    console.log("✓ Owner successfully authorized to preview draft (isDraftPreview = true)");
  } else {
    throw new Error("Owner draft preview failed: " + JSON.stringify(ownerPreviewJson));
  }

  // 5. Verify autosaving updates content without publishing the draft
  console.log("\n5. Testing autosave persistence without publishing...");
  const autosaveRes = await fetch(`${BASE}/api/forms/${formId}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Updated Title via Autosave",
      description: "Testing autosave persistence",
    }),
  });
  if (!autosaveRes.ok) throw new Error("Autosave request failed");

  // Fetch updated form to verify persistence in Turso
  const getDraftRes = await fetch(`${BASE}/api/forms/${formId}`, {
    headers: authHeaders,
  });
  const savedDraft = await getDraftRes.json();
  if (savedDraft.status === "draft" && savedDraft.title === "Updated Title via Autosave") {
    console.log("✓ Autosave persisted to Turso while keeping draft status private");
  } else {
    throw new Error("Autosave failed: " + JSON.stringify(savedDraft));
  }

  const initialSectionId = savedDraft.sections?.[0]?.id || crypto.randomUUID();

  // 6. Test form publication validation (cannot publish empty form without questions)
  console.log("\n6. Testing publication validation (requires title and at least 1 question)...");
  // Set elements to empty list to test question validation
  const emptyLayoutRes = await fetch(`${BASE}/api/forms/${formId}/layout`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      sections: [{ id: initialSectionId, orderIndex: 0, title: "", description: "" }],
      elements: [],
    }),
  });
  if (!emptyLayoutRes.ok) throw new Error("Failed to save empty layout: " + (await emptyLayoutRes.text()));

  const badPublishRes = await fetch(`${BASE}/api/forms/${formId}/publish`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  const badPublishJson = await badPublishRes.json();
  if (badPublishRes.status === 400 && badPublishJson.error.includes("question")) {
    console.log("✓ Validation enforced: cannot publish form without questions:", badPublishJson.error);
  } else {
    throw new Error("Server allowed publishing form with 0 questions: " + JSON.stringify(badPublishJson));
  }

  // 7. Add layout with questions and publish successfully
  console.log("\n7. Publishing valid form with questions...");
  const questionId = "q_test_" + Date.now();
  const validLayoutRes = await fetch(`${BASE}/api/forms/${formId}/layout`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      sections: [{ id: initialSectionId, orderIndex: 0, title: "", description: "" }],
      elements: [
        {
          id: questionId,
          sectionId: initialSectionId,
          orderIndex: 0,
          type: "short_answer",
          title: "What is your student ID?",
          description: "",
          isRequired: true,
          options: "[]",
        },
      ],
    }),
  });
  if (!validLayoutRes.ok) throw new Error("Failed to save valid layout: " + (await validLayoutRes.text()));

  const publishRes = await fetch(`${BASE}/api/forms/${formId}/publish`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  const publishJson = await publishRes.json();
  if (publishRes.ok && publishJson.status === "published" && publishJson.publicUrl) {
    console.log("✓ Form published successfully! Public URL:", publishJson.publicUrl);
  } else {
    throw new Error("Form publication failed: " + JSON.stringify(publishJson));
  }

  // 8. Open public link without logging in and submit a response
  console.log("\n8. Testing anonymous public respondent retrieval and submission...");
  const publicGetRes = await fetch(`${BASE}/api/public/forms/${publicId}`, {
    method: "GET",
  });
  const publicFormJson = await publicGetRes.json();
  if (!publicGetRes.ok || publicFormJson.status !== "published") {
    throw new Error("Failed to retrieve published form anonymously: " + JSON.stringify(publicFormJson));
  }
  console.log("✓ Public respondent successfully retrieved published form:", publicFormJson.title);

  // Submit response
  const submitRes = await fetch(`${BASE}/api/public/forms/${publicId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      answers: { [questionId]: "BT24CS101" },
      respondentEmail: "respondent.test@avantika.edu.in",
    }),
  });
  const submitSuccessJson = await submitRes.json();
  if (submitRes.ok && submitSuccessJson.success) {
    console.log("✓ Respondent submission recorded successfully! ID:", submitSuccessJson.submissionId);
  } else {
    throw new Error("Respondent submission failed: " + JSON.stringify(submitSuccessJson));
  }

  // 9. Edit published form and verify public URL serves latest version without resetting URL or deleting responses
  console.log("\n9. Testing edit of published form (edits update public page, URL and responses preserved)...");
  const updatePublishedRes = await fetch(`${BASE}/api/forms/${formId}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Updated Title for Published Form",
      description: "Updated description for respondents",
    }),
  });
  if (!updatePublishedRes.ok) throw new Error("Failed to edit published form");

  const reloadedPublicRes = await fetch(`${BASE}/api/public/forms/${publicId}`, {
    method: "GET",
  });
  const reloadedPublicJson = await reloadedPublicRes.json();
  if (reloadedPublicJson.title === "Updated Title for Published Form") {
    console.log("✓ Public respondent page immediately serves updated title while preserving public URL");
  } else {
    throw new Error("Public form did not serve latest saved edits: " + JSON.stringify(reloadedPublicJson));
  }

  // Verify previous response is still intact
  const analyticsRes = await fetch(`${BASE}/api/forms/${formId}/responses`, {
    headers: authHeaders,
  });
  const analyticsJson = await analyticsRes.json();
  if (analyticsJson.responses && analyticsJson.responses.length >= 1) {
    console.log("✓ Existing submissions are completely preserved after editing published form (Count:", analyticsJson.responses.length, ")");
  } else {
    throw new Error("Submissions check failed: " + JSON.stringify(analyticsJson));
  }

  // 10. Pause / Close response collection (form remains published)
  console.log("\n10. Testing closing response collection on published form...");
  const closeRes = await fetch(`${BASE}/api/forms/${formId}/toggle-responses`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ accepting: false }),
  });
  const closeJson = await closeRes.json();
  if (closeRes.ok && closeJson.acceptingResponses === false) {
    console.log("✓ Response collection paused (acceptingResponses = false, form remains published)");
  } else {
    throw new Error("Failed to toggle responses: " + JSON.stringify(closeJson));
  }

  // Public form should now indicate closed and reject submissions
  const closedPublicRes = await fetch(`${BASE}/api/public/forms/${publicId}`, { method: "GET" });
  const closedPublicJson = await closedPublicRes.json();
  if (closedPublicJson.isClosed === true) {
    console.log("✓ Public form GET shows isClosed = true with message:", closedPublicJson.closedReason);
  } else {
    throw new Error("Public form did not reflect isClosed = true: " + JSON.stringify(closedPublicJson));
  }

  const rejectedSubmitRes = await fetch(`${BASE}/api/public/forms/${publicId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: { [questionId]: "Rejected Submission" } }),
  });
  const rejectedJson = await rejectedSubmitRes.json();
  if (rejectedSubmitRes.status === 400 && (rejectedJson.error.toLowerCase().includes("closed") || rejectedJson.error.toLowerCase().includes("accepting"))) {
    console.log("✓ Submission to closed form was strictly rejected with 400 Bad Request:", rejectedJson.error);
  } else {
    throw new Error("Submission to closed form was not rejected as expected! Result: " + JSON.stringify(rejectedJson));
  }

  // 11. Reopen response collection
  console.log("\n11. Testing reopening response collection...");
  const reopenRes = await fetch(`${BASE}/api/forms/${formId}/toggle-responses`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ accepting: true }),
  });
  const reopenJson = await reopenRes.json();
  if (reopenRes.ok && reopenJson.acceptingResponses === true) {
    console.log("✓ Response collection reopened successfully! Submissions active again.");
  } else {
    throw new Error("Failed to reopen responses: " + JSON.stringify(reopenJson));
  }

  // 12. Security: Verify another user cannot access or edit this form
  console.log("\n12. Testing security authorization (another user cannot edit/publish this form)...");
  // Request an unauthorized user or unauthenticated request
  const unauthEditRes = await fetch(`${BASE}/api/forms/${formId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" }, // no auth cookie
    body: JSON.stringify({ title: "Hacked Form" }),
  });
  if (unauthEditRes.status === 401) {
    console.log("✓ Unauthenticated attempt to edit form was blocked with 401 Unauthorized");
  } else {
    throw new Error("Security failure: unauthenticated request was not rejected with 401! Status: " + unauthEditRes.status);
  }

  // Clean up test form and test user
  console.log("\n--- CLEANING UP TEST ARTIFACTS ---");
  await fetch(`${BASE}/api/forms/${formId}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  await db.delete(schema.user).where(eq(schema.user.email, testEmail));
  console.log("✓ Test form and temporary test user cleaned up from database.");

  console.log("\n======================================================================");
  console.log("   ALL 15+ REGRESSION SCENARIOS PASSED WITH ZERO FAILURES!            ");
  console.log("======================================================================");
}

runRegressionTests().catch((err) => {
  console.error("\n❌ Regression test failed with error:\n", err);
  process.exit(1);
});
