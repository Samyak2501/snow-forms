import { FastifyInstance } from "fastify";
import { db, schema } from "../db/index.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

export async function analyticsRoutes(fastify: FastifyInstance) {
  // 1. List Responses for a form
  fastify.get("/api/forms/:id/responses", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };

    const form = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (form.length === 0) {
      return reply.status(404).send({ error: "Form not found or unauthorized." });
    }

    let formSettings: any = {};
    try {
      formSettings = JSON.parse(form[0].formSettings || "{}");
    } catch {
      formSettings = {};
    }
    const requireCollegeLogin = Boolean(formSettings.requireCollegeLogin);

    const responses = await db
      .select()
      .from(schema.formResponses)
      .where(eq(schema.formResponses.formId, id))
      .orderBy(desc(schema.formResponses.submittedAt));

    const sanitizedResponses = responses.map((r) => ({
      ...r,
      respondentEmail: requireCollegeLogin ? r.respondentEmail : null,
    }));

    return reply.send({
      total: sanitizedResponses.length,
      responses: sanitizedResponses,
    });
  });

  // 2. Get Single Response Detail with question answers
  fastify.get("/api/forms/:id/responses/:responseId", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id, responseId } = request.params as { id: string; responseId: string };

    const form = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (form.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    const responseRecord = await db
      .select()
      .from(schema.formResponses)
      .where(and(eq(schema.formResponses.id, responseId), eq(schema.formResponses.formId, id)))
      .limit(1);

    if (responseRecord.length === 0) {
      return reply.status(404).send({ error: "Response not found." });
    }

    const elements = await db
      .select()
      .from(schema.formElements)
      .where(eq(schema.formElements.formId, id))
      .orderBy(schema.formElements.orderIndex);

    const answers = await db
      .select()
      .from(schema.formAnswers)
      .where(eq(schema.formAnswers.responseId, responseId));

    const answerMap = new Map(answers.map((a) => [a.elementId, a]));

    const details = elements
      .filter((el) => !["title_desc", "image", "video"].includes(el.type))
      .map((el) => {
        const ans = answerMap.get(el.id);
        let parsedVal: any = ans?.answerValue ?? null;
        try {
          if (parsedVal && (parsedVal.startsWith("{") || parsedVal.startsWith("["))) {
            parsedVal = JSON.parse(parsedVal);
          }
        } catch {
          // keep as string
        }

        return {
          elementId: el.id,
          title: el.title,
          type: el.type,
          points: el.points,
          answer: parsedVal,
          isCorrect: ans?.isCorrect ?? null,
          scoreAwarded: ans?.scoreAwarded ?? 0,
          feedback: ans?.feedback ?? null,
          scaleSettings: el.scaleSettings ?? null,
        };
      });

    let formSettings: any = {};
    try {
      formSettings = JSON.parse(form[0].formSettings || "{}");
    } catch {
      formSettings = {};
    }
    const requireCollegeLogin = Boolean(formSettings.requireCollegeLogin);

    return reply.send({
      response: {
        ...responseRecord[0],
        respondentEmail: requireCollegeLogin ? responseRecord[0].respondentEmail : null,
      },
      details,
    });
  });

  // 3. Manual grading update for a response answer (e.g. paragraph questions)
  fastify.put("/api/forms/:id/responses/:responseId/grade", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id, responseId } = request.params as { id: string; responseId: string };
    const body = request.body as {
      elementId: string;
      scoreAwarded: number;
      feedback?: string;
      isCorrect?: boolean;
    };

    const form = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (form.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    await db
      .update(schema.formAnswers)
      .set({
        scoreAwarded: body.scoreAwarded,
        isCorrect: body.isCorrect ?? (body.scoreAwarded > 0),
        feedback: body.feedback || null,
      })
      .where(
        and(
          eq(schema.formAnswers.responseId, responseId),
          eq(schema.formAnswers.elementId, body.elementId)
        )
      );

    // Recalculate total score for response
    const allAnswers = await db
      .select()
      .from(schema.formAnswers)
      .where(eq(schema.formAnswers.responseId, responseId));

    const totalScore = allAnswers.reduce((sum, a) => sum + (a.scoreAwarded || 0), 0);

    await db
      .update(schema.formResponses)
      .set({ totalScore })
      .where(eq(schema.formResponses.id, responseId));

    return reply.send({ success: true, totalScore });
  });

  // 4. Aggregated Analytics & Chart Data
  fastify.get("/api/forms/:id/analytics", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };

    const form = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (form.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    const responses = await db
      .select()
      .from(schema.formResponses)
      .where(eq(schema.formResponses.formId, id));

    const elements = await db
      .select()
      .from(schema.formElements)
      .where(eq(schema.formElements.formId, id))
      .orderBy(schema.formElements.orderIndex);

    const allAnswers = await db
      .select()
      .from(schema.formAnswers)
      .innerJoin(schema.formResponses, eq(schema.formAnswers.responseId, schema.formResponses.id))
      .where(eq(schema.formResponses.formId, id));

    // Group answers by elementId
    const answersByElement: Record<string, any[]> = {};
    for (const row of allAnswers) {
      const elId = row.form_answers.elementId;
      if (!answersByElement[elId]) answersByElement[elId] = [];
      answersByElement[elId].push(row.form_answers.answerValue);
    }

    // Process each question into chart / distribution metrics
    const questionAnalytics = elements
      .filter((el) => !["title_desc", "image", "video"].includes(el.type))
      .map((el) => {
        const rawAnswers = answersByElement[el.id] || [];
        const nonNullAnswers = rawAnswers.filter((a) => a !== null && a !== "");

        let summaryData: any = null;

        if (["multiple_choice", "dropdown"].includes(el.type)) {
          // Count frequency of each option
          const counts: Record<string, number> = {};
          nonNullAnswers.forEach((ans) => {
            counts[ans] = (counts[ans] || 0) + 1;
          });

          // Parse options if available
          let optLabels: string[] = [];
          try {
            const opts = JSON.parse(el.options || "[]");
            optLabels = opts.map((o: any) => o.text || o);
          } catch {
            optLabels = [];
          }

          summaryData = Object.entries(counts).map(([name, count]) => ({
            name,
            count,
            percentage: nonNullAnswers.length > 0 ? Math.round((count / nonNullAnswers.length) * 100) : 0,
          }));
        } else if (el.type === "checkboxes") {
          // Multiple selections array
          const counts: Record<string, number> = {};
          nonNullAnswers.forEach((ans) => {
            try {
              const parsed = JSON.parse(ans);
              if (Array.isArray(parsed)) {
                parsed.forEach((val) => {
                  counts[val] = (counts[val] || 0) + 1;
                });
              } else {
                counts[ans] = (counts[ans] || 0) + 1;
              }
            } catch {
              counts[ans] = (counts[ans] || 0) + 1;
            }
          });

          summaryData = Object.entries(counts).map(([name, count]) => ({
            name,
            count,
            percentage: nonNullAnswers.length > 0 ? Math.round((count / nonNullAnswers.length) * 100) : 0,
          }));
        } else if (el.type === "linear_scale" || el.type === "rating") {
          // Numeric distribution
          const counts: Record<string, number> = {};
          nonNullAnswers.forEach((ans) => {
            counts[ans] = (counts[ans] || 0) + 1;
          });
          summaryData = Object.entries(counts)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([rating, count]) => ({
              rating,
              count,
            }));
        } else if (["mc_grid", "checkbox_grid"].includes(el.type)) {
          // Matrix Grid breakdown by row and column
          const rowStats: Record<string, Record<string, number>> = {};
          nonNullAnswers.forEach((ans) => {
            try {
              const parsed = typeof ans === "string" ? JSON.parse(ans) : ans;
              if (parsed && typeof parsed === "object") {
                Object.entries(parsed).forEach(([row, colVal]) => {
                  if (!rowStats[row]) rowStats[row] = {};
                  if (Array.isArray(colVal)) {
                    colVal.forEach((c) => {
                      rowStats[row][c] = (rowStats[row][c] || 0) + 1;
                    });
                  } else if (colVal) {
                    const c = String(colVal);
                    rowStats[row][c] = (rowStats[row][c] || 0) + 1;
                  }
                });
              }
            } catch {}
          });
          summaryData = rowStats;
        } else if (["short_answer", "paragraph", "date", "time"].includes(el.type)) {
          // List of recent text answers
          summaryData = nonNullAnswers.slice(0, 50);
        }

        return {
          elementId: el.id,
          title: el.title,
          type: el.type,
          totalResponses: nonNullAnswers.length,
          data: summaryData,
        };
      });

    // Score distribution for quiz mode
    let quizSummary: any = null;
    if (form[0].isQuiz) {
      const scores = responses
        .map((r) => r.totalScore)
        .filter((s): s is number => s !== null && s !== undefined);

      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const maxScore = responses[0]?.maxScore || 0;

      quizSummary = {
        totalGraded: scores.length,
        averageScore: avgScore,
        maxScore,
        scoreDistribution: scores,
      };
    }

    return reply.send({
      totalResponses: responses.length,
      questions: questionAnalytics,
      quizSummary,
    });
  });

  // 5. CSV Export of All Responses
  fastify.get("/api/forms/:id/export/csv", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };

    const form = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (form.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    const elements = await db
      .select()
      .from(schema.formElements)
      .where(eq(schema.formElements.formId, id))
      .orderBy(schema.formElements.orderIndex);

    const questionElements = elements.filter(
      (el) => !["title_desc", "image", "video"].includes(el.type)
    );

    const responses = await db
      .select()
      .from(schema.formResponses)
      .where(eq(schema.formResponses.formId, id))
      .orderBy(desc(schema.formResponses.submittedAt));

    const allAnswers = await db
      .select()
      .from(schema.formAnswers)
      .innerJoin(schema.formResponses, eq(schema.formAnswers.responseId, schema.formResponses.id))
      .where(eq(schema.formResponses.formId, id));

    // Map answers by responseId and elementId
    const answerGrid: Record<string, Record<string, string>> = {};
    for (const r of responses) {
      answerGrid[r.id] = {};
    }
    for (const row of allAnswers) {
      const respId = row.form_answers.responseId;
      const elId = row.form_answers.elementId;
      if (answerGrid[respId]) {
        answerGrid[respId][elId] = row.form_answers.answerValue || "";
      }
    }

    let formSettings: any = {};
    try {
      formSettings = JSON.parse(form[0].formSettings || "{}");
    } catch {
      formSettings = {};
    }
    const requireCollegeLogin = Boolean(formSettings.requireCollegeLogin);

    // Build CSV Headers
    const headers = [
      "Submission ID",
      "Timestamp",
      "Respondent Email",
      ...(form[0].isQuiz ? ["Score", "Max Score", "Submission Trigger", "Tab Switches"] : []),
      ...questionElements.map((el) => `"${(el.title || "Question").replace(/"/g, '""')}"`),
    ];

    const rows: string[] = [headers.join(",")];

    for (const r of responses) {
      const emailToExport = requireCollegeLogin ? (r.respondentEmail || "") : "";
      const rowData = [
        `"${r.id}"`,
        `"${r.submittedAt.toISOString()}"`,
        `"${emailToExport.replace(/"/g, '""')}"`,
        ...(form[0].isQuiz ? [r.totalScore ?? 0, r.maxScore ?? 0, `"${(r as any).submissionTrigger || "manual"}"`, (r as any).tabSwitchCount ?? 0] : []),
        ...questionElements.map((el) => {
          const val = answerGrid[r.id]?.[el.id] || "";
          return `"${val.replace(/"/g, '""')}"`;
        }),
      ];
      rows.push(rowData.join(","));
    }

    const csvContent = rows.join("\n");
    const sanitizedTitle = (form[0].title || "form").replace(/[^a-zA-Z0-9]/g, "_");

    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="${sanitizedTitle}_responses.csv"`);
    return reply.send(csvContent);
  });

  // 6. Delete a single response
  fastify.delete("/api/forms/:id/responses/:responseId", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id, responseId } = request.params as { id: string; responseId: string };

    const form = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (form.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    await db.delete(schema.formResponses).where(eq(schema.formResponses.id, responseId));

    return reply.send({ success: true, message: "Response deleted successfully." });
  });
}
