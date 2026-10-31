import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, schema } from "../db/index.js";
import { eq, and, or, sql } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/index.js";
import crypto from "crypto";

// In-memory mutex tracking in-flight submissions per (formId:normalizedEmail) to prevent race conditions
const activeSubmissions = new Set<string>();

export async function submissionRoutes(fastify: FastifyInstance) {
  // 1. Get Public Form Data for Respondents
  fastify.get("/api/public/forms/:publicId", async (request, reply) => {
    const { publicId } = request.params as { publicId: string };

    const formRecords = await db
      .select()
      .from(schema.forms)
      .where(eq(schema.forms.publicId, publicId))
      .limit(1);

    if (formRecords.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    const form = formRecords[0];

    // Parse form settings first
    let parsedSettings: any = {};
    try {
      parsedSettings = JSON.parse(form.formSettings || "{}");
    } catch {
      parsedSettings = {};
    }

    // Check optional authenticated respondent
    const headers = fromNodeHeaders(request.headers);
    const session = await auth.api.getSession({ headers });
    const isOwner = session?.user?.id === form.ownerId;

    // Security: Unpublished drafts are private to owner and must never leak to anonymous respondents
    if (form.status === "draft") {
      if (!isOwner) {
        return reply.status(404).send({
          error: "This form is currently an unpublished draft and is not accessible to the public.",
          isDraft: true,
        });
      }
    }

    // Check response collection status (separate from publication status!)
    const now = new Date();
    let isClosed = false;
    let closedReason = "";

    if (parsedSettings.acceptingResponses === false || form.status === "closed") {
      isClosed = true;
      closedReason = parsedSettings.closedMessage || "This form is no longer accepting responses.";
    } else if (form.opensAt && form.opensAt > now) {
      isClosed = true;
      closedReason = `This form is not open yet. It will open on ${form.opensAt.toLocaleString()}.`;
    } else if (form.closesAt && form.closesAt < now) {
      isClosed = true;
      closedReason = `This form was closed on ${form.closesAt.toLocaleString()}.`;
    }

    // Check response capacity limits
    if (!isClosed && form.maxResponses) {
      const responseCountRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.formResponses)
        .where(eq(schema.formResponses.formId, form.id));
      const count = responseCountRes[0]?.count || 0;
      if (count >= form.maxResponses) {
        isClosed = true;
        closedReason = "This form has reached its maximum response capacity and is no longer accepting submissions.";
      }
    }

    // Check authentication requirements
    const requireCollegeLogin = Boolean(parsedSettings.requireCollegeLogin);
    const limitOneResponse = Boolean(parsedSettings.limitOneResponse);

    if ((requireCollegeLogin || limitOneResponse) && !session?.user) {
      const message = requireCollegeLogin
        ? "This form is restricted to Avantika University accounts. Please sign in with your campus email (@avantika.edu.in) to continue."
        : "This form is limited to 1 response per person. Please sign in to submit your response.";

      return reply.send({
        id: form.id,
        publicId: form.publicId,
        title: form.title,
        requiresAuth: true,
        authReason: requireCollegeLogin ? "college_login" : "limit_one_response",
        message,
      });
    }

    // If requireCollegeLogin is enabled and user is logged in, verify email domain
    if (requireCollegeLogin && session?.user?.email) {
      const userEmail = session.user.email.toLowerCase().trim();
      const collegeDomain = process.env.COLLEGE_EMAIL_DOMAIN || "avantika.edu.in";
      if (!userEmail.endsWith(`@${collegeDomain}`) && !userEmail.endsWith(`.${collegeDomain}`)) {
        return reply.send({
          id: form.id,
          publicId: form.publicId,
          title: form.title,
          requiresAuth: true,
          authReason: "invalid_domain",
          message: `This form is strictly restricted to Avantika University accounts (@${collegeDomain}). Your signed-in account (${userEmail}) is not authorized.`,
        });
      }
    }

    // Check "Limit to 1 response" (when enabled and user is logged in)
    let alreadySubmitted = false;
    if (limitOneResponse && session?.user) {
      const normalizedEmail = (session.user.email || "").toLowerCase().trim();
      const prevSubmissions = await db
        .select({ id: schema.formResponses.id })
        .from(schema.formResponses)
        .where(
          and(
            eq(schema.formResponses.formId, form.id),
            or(
              eq(schema.formResponses.respondentId, session.user.id),
              sql`lower(trim(${schema.formResponses.respondentEmail})) = ${normalizedEmail}`
            )
          )
        )
        .limit(1);

      if (prevSubmissions.length > 0) {
        alreadySubmitted = true;
      }
    }

    // Fetch Sections
    const sections = await db
      .select()
      .from(schema.formSections)
      .where(eq(schema.formSections.formId, form.id))
      .orderBy(schema.formSections.orderIndex);

    // Fetch Elements (CRITICAL SECURITY: Omit quizAnswerKey for public respondents!)
    const rawElements = await db
      .select()
      .from(schema.formElements)
      .where(eq(schema.formElements.formId, form.id))
      .orderBy(schema.formElements.orderIndex);

    const sanitizedElements = rawElements.map((el) => {
      const { quizAnswerKey, ...safeProps } = el;
      return safeProps;
    });

    return reply.send({
      id: form.id,
      publicId: form.publicId,
      title: form.title,
      description: form.description,
      status: form.status,
      themeSettings: form.themeSettings ? JSON.parse(form.themeSettings) : {},
      formSettings: parsedSettings,
      isQuiz: form.isQuiz,
      quizSettings: form.quizSettings ? JSON.parse(form.quizSettings) : {},
      isClosed,
      closedReason,
      alreadySubmitted,
      sections,
      elements: sanitizedElements,
      currentUser: session?.user || null,
      isDraftPreview: form.status === "draft" && isOwner,
    });
  });

  // 2. Submit Public Form
  fastify.post("/api/public/forms/:publicId/submit", async (request, reply) => {
    const { publicId } = request.params as { publicId: string };
    const body = request.body as {
      answers: Record<string, any>; // elementId -> value
      respondentEmail?: string;
    };

    const formRecords = await db
      .select()
      .from(schema.forms)
      .where(eq(schema.forms.publicId, publicId))
      .limit(1);

    if (formRecords.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    const form = formRecords[0];

    // Check optional authenticated user
    const headers = fromNodeHeaders(request.headers);
    const session = await auth.api.getSession({ headers });

    // Parse form settings
    let formSettings: any = {};
    try {
      formSettings = JSON.parse(form.formSettings || "{}");
    } catch {
      formSettings = {};
    }

    // 1. Unpublished drafts cannot accept submissions
    if (form.status === "draft") {
      return reply.status(403).send({ error: "This form is currently an unpublished draft and cannot accept submissions." });
    }

    // 2. Check response collection status (owner toggle)
    if (formSettings.acceptingResponses === false || form.status === "closed") {
      return reply.status(400).send({
        error: formSettings.closedMessage || "This form is closed and no longer accepting submissions.",
      });
    }

    // 3. Enforce form status & deadlines
    const now = new Date();
    if (form.opensAt && form.opensAt > now) {
      return reply.status(400).send({ error: "This form has not opened yet." });
    }
    if (form.closesAt && form.closesAt < now) {
      return reply.status(400).send({ error: "The deadline for this form has passed." });
    }

    // 4. Check response capacity limits
    if (form.maxResponses) {
      const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.formResponses)
        .where(eq(schema.formResponses.formId, form.id));
      if ((countRes[0]?.count || 0) >= form.maxResponses) {
        return reply.status(400).send({ error: "This form has reached its submission limit." });
      }
    }

    const requireCollegeLogin = Boolean(formSettings.requireCollegeLogin);
    const limitOneResponse = Boolean(formSettings.limitOneResponse);

    // Check College login restriction
    if (requireCollegeLogin) {
      if (!session?.user) {
        return reply.status(401).send({ error: "Avantika University authentication is required to submit this form." });
      }
      const collegeDomain = process.env.COLLEGE_EMAIL_DOMAIN || "avantika.edu.in";
      const userEmail = (session.user.email || "").toLowerCase().trim();
      if (!userEmail.endsWith(`@${collegeDomain}`) && !userEmail.endsWith(`.${collegeDomain}`)) {
        return reply.status(403).send({ error: `This form is strictly restricted to @${collegeDomain} accounts.` });
      }
    }

    // Check "Limit to 1 response" authentication requirement
    if (limitOneResponse && !session?.user) {
      return reply.status(401).send({
        error: requireCollegeLogin
          ? "Avantika University authentication is required to submit this form."
          : "Sign in is required to submit this form (limit 1 response per person).",
      });
    }

    // Normalized respondent email from verified session
    const respondentId = session?.user?.id || null;
    const normalizedEmail = session?.user?.email
      ? session.user.email.toLowerCase().trim()
      : null;

    // Concurrency Lock for limitOneResponse to prevent simultaneous submission race conditions
    let lockKey: string | null = null;
    if (limitOneResponse && normalizedEmail) {
      lockKey = `${form.id}:${normalizedEmail}`;
      if (activeSubmissions.has(lockKey)) {
        return reply.status(400).send({
          error: "You have already submitted a response to this form.",
        });
      }
      activeSubmissions.add(lockKey);
    }

    try {
      if (limitOneResponse && session?.user && normalizedEmail) {
        const prev = await db
          .select({ id: schema.formResponses.id })
          .from(schema.formResponses)
          .where(
            and(
              eq(schema.formResponses.formId, form.id),
              or(
                eq(schema.formResponses.respondentId, session.user.id),
                sql`lower(trim(${schema.formResponses.respondentEmail})) = ${normalizedEmail}`
              )
            )
          )
          .limit(1);

        if (prev.length > 0) {
          return reply.status(400).send({ error: "You have already submitted a response to this form." });
        }
      }

    // Fetch elements to validate answers and grade quiz
    const elements = await db
      .select()
      .from(schema.formElements)
      .where(eq(schema.formElements.formId, form.id));

    const submittedAnswers = body.answers || {};

    // Validate Required and Data Constraints
    for (const el of elements) {
      // Skip static non-question elements
      if (["title_desc", "image", "video"].includes(el.type)) continue;

      const val = submittedAnswers[el.id];

      if (el.isRequired) {
        if (el.type === "mc_grid") {
          let rows: string[] = [];
          try {
            const parsed = typeof el.options === "string" ? JSON.parse(el.options || "{}") : el.options;
            if (Array.isArray(parsed?.rows)) {
              rows = parsed.rows.map((r: any) => (typeof r === "string" ? r : r.text));
            }
          } catch {}
          const gridAns = val && typeof val === "object" ? val : {};
          const allAnswered = rows.length > 0
            ? rows.every((r) => gridAns[r] !== undefined && gridAns[r] !== null && gridAns[r] !== "")
            : Object.keys(gridAns).length > 0;
          if (!allAnswered) {
            return reply.status(400).send({
              error: `Question "${el.title || "Required question"}" requires a response in each row.`,
              elementId: el.id,
            });
          }
          continue;
        }

        if (el.type === "checkbox_grid") {
          let rows: string[] = [];
          try {
            const parsed = typeof el.options === "string" ? JSON.parse(el.options || "{}") : el.options;
            if (Array.isArray(parsed?.rows)) {
              rows = parsed.rows.map((r: any) => (typeof r === "string" ? r : r.text));
            }
          } catch {}
          const gridAns = val && typeof val === "object" ? val : {};
          const allAnswered = rows.length > 0
            ? rows.every((r) => Array.isArray(gridAns[r]) && gridAns[r].length > 0)
            : Object.keys(gridAns).length > 0;
          if (!allAnswered) {
            return reply.status(400).send({
              error: `Question "${el.title || "Required question"}" requires at least one response in each row.`,
              elementId: el.id,
            });
          }
          continue;
        }

        const isEmpty =
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          return reply.status(400).send({
            error: `Question "${el.title || "Required question"}" is required.`,
            elementId: el.id,
          });
        }
      }
    }

    // Process Submission & Quiz Grading
    let totalScore = 0;
    let maxScore = 0;
    const answerRecordsToInsert: any[] = [];
    const responseId = crypto.randomUUID();

    for (const el of elements) {
      if (["title_desc", "image", "video"].includes(el.type)) continue;

      const rawVal = submittedAnswers[el.id];
      const stringifiedVal = typeof rawVal === "object" ? JSON.stringify(rawVal) : String(rawVal ?? "");

      let isCorrect: boolean | null = null;
      let scoreAwarded = 0;

      if (form.isQuiz) {
        maxScore += el.points || 0;

        if (el.quizAnswerKey) {
          try {
            const key = JSON.parse(el.quizAnswerKey);
            const correctAnswers: string[] = key.correctAnswers || [];

            if (["multiple_choice", "dropdown", "linear_scale", "rating"].includes(el.type)) {
              // Single selection match
              isCorrect = correctAnswers.includes(String(rawVal));
              if (isCorrect) scoreAwarded = el.points || 0;
            } else if (el.type === "checkboxes") {
              // Checkboxes: all correct must be selected, no incorrect selected
              const userChoices = Array.isArray(rawVal) ? rawVal.map(String) : [];
              const sortedUser = [...userChoices].sort();
              const sortedCorrect = [...correctAnswers].sort();
              isCorrect =
                sortedUser.length === sortedCorrect.length &&
                sortedUser.every((val, idx) => val === sortedCorrect[idx]);
              if (isCorrect) scoreAwarded = el.points || 0;
            } else if (el.type === "short_answer") {
              // Case-insensitive exact text match against any of correct answers
              const trimmed = String(rawVal || "").trim().toLowerCase();
              isCorrect = correctAnswers.some((ans) => ans.trim().toLowerCase() === trimmed);
              if (isCorrect) scoreAwarded = el.points || 0;
            } else {
              // Paragraph or grids -> manual grading
              isCorrect = null;
              scoreAwarded = 0;
            }
          } catch {
            isCorrect = null;
          }
        }

        totalScore += scoreAwarded;
      }

      answerRecordsToInsert.push({
        id: crypto.randomUUID(),
        responseId,
        elementId: el.id,
        answerValue: stringifiedVal,
        isCorrect,
        scoreAwarded,
        createdAt: new Date(),
      });
    }

      // Insert Form Response
      const ipHash = crypto
        .createHash("sha256")
        .update((request.ip || "127.0.0.1") + (process.env.BETTER_AUTH_SECRET || ""))
        .digest("hex");

      await db.insert(schema.formResponses).values({
        id: responseId,
        formId: form.id,
        respondentId: (limitOneResponse || requireCollegeLogin) ? respondentId : null,
        respondentEmail: requireCollegeLogin ? normalizedEmail : null,
        submittedAt: new Date(),
        totalScore: form.isQuiz ? totalScore : null,
        maxScore: form.isQuiz ? maxScore : null,
        status: "completed",
        ipHash,
        userAgent: (request.headers["user-agent"] as string) || null,
      });

      // Insert Answer Records
      for (const ans of answerRecordsToInsert) {
        await db.insert(schema.formAnswers).values(ans);
      }

      // Response confirmation payload
      const quizSettings = form.quizSettings ? JSON.parse(form.quizSettings) : {};
      const confirmationMessage =
        formSettings.confirmationMessage || "Your response has been recorded. Thank you!";

      return reply.status(201).send({
        success: true,
        message: confirmationMessage,
        responseId,
        isQuiz: form.isQuiz,
        score:
          form.isQuiz && quizSettings.immediateRelease
            ? {
                totalScore,
                maxScore,
                percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100,
              }
            : null,
        allowSubmitAnother: limitOneResponse ? false : (formSettings.submitAnotherLink ?? true),
      });
    } finally {
      if (lockKey) {
        activeSubmissions.delete(lockKey);
      }
    }
  });
}
