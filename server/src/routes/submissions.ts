import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, schema } from "../db/index.js";
import { eq, and, sql } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/index.js";
import crypto from "crypto";

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

    // Check optional authenticated respondent
    const headers = fromNodeHeaders(request.headers);
    const session = await auth.api.getSession({ headers });
    const isOwner = session?.user?.id === form.ownerId;

    // If draft and not owner, return 404
    if (form.status === "draft" && !isOwner) {
      return reply.status(404).send({
        error: "This form is currently a draft and has not been published yet.",
        isDraft: true,
      });
    }

    // Check open & close time limits
    const now = new Date();
    let isClosed = form.status === "closed" || form.status === "archived";
    let closedReason = "";

    if (form.status === "closed") {
      closedReason = "This form has been manually closed by the organizer.";
    } else if (form.status === "archived") {
      closedReason = "This form has been archived and is no longer accepting responses.";
    } else if (form.opensAt && form.opensAt > now) {
      isClosed = true;
      closedReason = `This form is not open yet. It will open on ${form.opensAt.toLocaleString()}.`;
    } else if (form.closesAt && form.closesAt < now) {
      isClosed = true;
      closedReason = `This form was closed on ${form.closesAt.toLocaleString()}.`;
    }

    // Check response limits
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

    // Parse form settings
    let parsedSettings: any = {};
    try {
      parsedSettings = JSON.parse(form.formSettings || "{}");
    } catch {
      parsedSettings = {};
    }

    // Check college domain restriction
    if (parsedSettings.requireCollegeLogin && !session?.user) {
      return reply.send({
        id: form.id,
        publicId: form.publicId,
        title: form.title,
        requiresAuth: true,
        message: "This form requires signing in with an Avantika University account.",
      });
    }

    // Check "Limit to 1 response"
    let alreadySubmitted = false;
    if (parsedSettings.limitOneResponse && session?.user) {
      const prevSubmissions = await db
        .select()
        .from(schema.formResponses)
        .where(
          and(
            eq(schema.formResponses.formId, form.id),
            eq(schema.formResponses.respondentId, session.user.id)
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

    // Enforce form status & deadlines
    const now = new Date();
    if (form.status === "closed" || form.status === "archived") {
      return reply.status(400).send({ error: "This form is closed and no longer accepting submissions." });
    }
    if (form.status === "draft" && session?.user?.id !== form.ownerId) {
      return reply.status(400).send({ error: "This form is not yet published." });
    }
    if (form.opensAt && form.opensAt > now) {
      return reply.status(400).send({ error: "This form has not opened yet." });
    }
    if (form.closesAt && form.closesAt < now) {
      return reply.status(400).send({ error: "The deadline for this form has passed." });
    }

    // Check response limits
    if (form.maxResponses) {
      const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.formResponses)
        .where(eq(schema.formResponses.formId, form.id));
      if ((countRes[0]?.count || 0) >= form.maxResponses) {
        return reply.status(400).send({ error: "This form has reached its submission limit." });
      }
    }

    // Parse form settings
    let formSettings: any = {};
    try {
      formSettings = JSON.parse(form.formSettings || "{}");
    } catch {
      formSettings = {};
    }

    // Check College login restriction
    if (formSettings.requireCollegeLogin && !session?.user) {
      return reply.status(401).send({ error: "Avantika University authentication is required to submit this form." });
    }

    // Check "Limit to 1 response"
    if (formSettings.limitOneResponse && session?.user) {
      const prev = await db
        .select()
        .from(schema.formResponses)
        .where(
          and(
            eq(schema.formResponses.formId, form.id),
            eq(schema.formResponses.respondentId, session.user.id)
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

      // If value is provided, run validation rules
      if (val !== undefined && val !== null && val !== "" && el.validation) {
        try {
          const rule = typeof el.validation === "string" ? JSON.parse(el.validation) : el.validation;
          const customMsg = rule.customError || "Invalid answer format.";

          if (rule.category === "number") {
            const num = Number(val);
            if (isNaN(num)) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "greater_than" && !(num > Number(rule.val))) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "less_than" && !(num < Number(rule.val))) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "between" && !(num >= Number(rule.min) && num <= Number(rule.max))) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "is_integer" && !Number.isInteger(num)) return reply.status(400).send({ error: customMsg });
          } else if (rule.category === "text") {
            const str = String(val);
            if (rule.rule === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "url" && !/^https?:\/\/.+/.test(str)) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "contains" && !str.includes(rule.val)) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "does_not_contain" && str.includes(rule.val)) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "max_length" && str.length > Number(rule.val)) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "regex" && rule.pattern) {
              const re = new RegExp(rule.pattern);
              if (!re.test(str)) return reply.status(400).send({ error: customMsg });
            }
          } else if (rule.category === "checkbox") {
            const arr = Array.isArray(val) ? val : [];
            if (rule.rule === "at_least" && arr.length < Number(rule.val)) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "at_most" && arr.length > Number(rule.val)) return reply.status(400).send({ error: customMsg });
            if (rule.rule === "exactly" && arr.length !== Number(rule.val)) return reply.status(400).send({ error: customMsg });
          }
        } catch {
          // ignore malformed rule
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

            if (["multiple_choice", "dropdown", "linear_scale"].includes(el.type)) {
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
      respondentId: session?.user?.id || null,
      respondentEmail: body.respondentEmail || session?.user?.email || null,
      submittedAt: new Date(),
      totalScore: form.isQuiz ? totalScore : null,
      maxScore: form.isQuiz ? maxScore : null,
      status: "completed",
      ipHash,
      userAgent: request.headers["user-agent"] || null,
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
      allowSubmitAnother: formSettings.submitAnotherLink ?? true,
    });
  });
}
