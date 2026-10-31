import { FastifyInstance } from "fastify";
import { db, schema } from "../db/index.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { cleanupFormExclusiveMedia, cleanupExpiredAuthRecords } from "../services/cleanup.js";
import { z } from "zod";

function generatePublicId(): string {
  // 10-char unguessable alphanumeric ID
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomBytes = crypto.getRandomValues(new Uint8Array(10));
  for (let i = 0; i < 10; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

export async function formRoutes(fastify: FastifyInstance) {
  // 1. List user's forms
  fastify.get("/api/forms", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const query = request.query as { status?: string; search?: string };

    let userForms = await db
      .select({
        id: schema.forms.id,
        publicId: schema.forms.publicId,
        title: schema.forms.title,
        description: schema.forms.description,
        status: schema.forms.status,
        formSettings: schema.forms.formSettings,
        isQuiz: schema.forms.isQuiz,
        opensAt: schema.forms.opensAt,
        closesAt: schema.forms.closesAt,
        maxResponses: schema.forms.maxResponses,
        createdAt: schema.forms.createdAt,
        updatedAt: schema.forms.updatedAt,
      })
      .from(schema.forms)
      .where(eq(schema.forms.ownerId, authData.user.id))
      .orderBy(desc(schema.forms.updatedAt));

    const now = new Date();

    // Get response counts and compute lifecycle statuses
    const formsWithCounts = await Promise.all(
      userForms.map(async (form) => {
        const responseCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.formResponses)
          .where(eq(schema.formResponses.formId, form.id));

        let formSettings: any = {};
        try {
          formSettings = JSON.parse(form.formSettings || "{}");
        } catch {
          formSettings = {};
        }

        // Separate publication status vs response collection status
        // Publication status is either 'draft' or 'published' (legacy 'closed' maps to 'published')
        const isDraft = form.status === "draft";
        const isPublished = form.status === "published" || form.status === "closed";

        // Response collection status
        const isExpired = Boolean(form.closesAt && new Date(form.closesAt) < now);
        const isManuallyClosed = formSettings.acceptingResponses === false || form.status === "closed";
        const isAcceptingResponses = isPublished && !isManuallyClosed && !isExpired;

        return {
          id: form.id,
          publicId: form.publicId,
          title: form.title,
          description: form.description,
          status: isDraft ? "draft" : !isAcceptingResponses ? "closed" : "published",
          rawStatus: form.status,
          isDraft,
          isPublished,
          isAcceptingResponses,
          isQuiz: form.isQuiz,
          opensAt: form.opensAt,
          closesAt: form.closesAt,
          maxResponses: form.maxResponses,
          createdAt: form.createdAt,
          updatedAt: form.updatedAt,
          responseCount: responseCount[0]?.count || 0,
        };
      })
    );

    let filtered = formsWithCounts;
    if (query.status && query.status !== "all") {
      if (query.status === "published") {
        filtered = filtered.filter((f) => f.isPublished && f.isAcceptingResponses);
      } else if (query.status === "draft") {
        filtered = filtered.filter((f) => f.isDraft);
      } else if (query.status === "closed") {
        filtered = filtered.filter((f) => f.isPublished && !f.isAcceptingResponses);
      }
    }
    if (query.search && query.search.trim()) {
      const q = query.search.toLowerCase().trim();
      filtered = filtered.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          (f.description && f.description.toLowerCase().includes(q))
      );
    }

    return reply.send({
      forms: filtered,
      summary: {
        total: formsWithCounts.length,
        published: formsWithCounts.filter((f) => f.isPublished && f.isAcceptingResponses).length,
        draft: formsWithCounts.filter((f) => f.isDraft).length,
        closed: formsWithCounts.filter((f) => f.isPublished && !f.isAcceptingResponses).length,
        totalResponses: formsWithCounts.reduce((acc, f) => acc + (f.responseCount || 0), 0),
      },
    });
  });

  // 2. Create new form (always creates a private draft)
  fastify.post("/api/forms", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const bodySchema = z.object({
      title: z.string().default("Untitled Form"),
      description: z.string().default(""),
      isQuiz: z.boolean().default(false),
      template: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(request.body || {});
    const data = parsed.success ? parsed.data : { title: "Untitled Form", description: "", isQuiz: false, template: undefined };

    const formId = crypto.randomUUID();
    const publicId = generatePublicId();

    // Event Registration Template Initialization
    if (data.template === "event_registration") {
      const templateTitle = "Event Registration";
      const templateDescription =
        "Please review the event details below and complete the registration form to register for this event.";

      await db.insert(schema.forms).values({
        id: formId,
        publicId,
        ownerId: authData.user.id,
        title: templateTitle,
        description: templateDescription,
        status: "draft",
        isQuiz: false,
        formSettings: JSON.stringify({
          collectEmail: false,
          requireCollegeLogin: false,
          limitOneResponse: false,
          shuffleQuestions: false,
          showProgressBar: true,
          allowEditResponse: false,
          allowViewSummary: false,
          confirmationMessage: "Your response has been recorded. Thank you!",
          submitAnotherLink: true,
          acceptingResponses: true,
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const section1Id = crypto.randomUUID();
      const section2Id = crypto.randomUUID();

      // Section 1 — Event Information (empty title per first-section convention)
      await db.insert(schema.formSections).values({
        id: section1Id,
        formId,
        orderIndex: 0,
        title: "",
        description: "",
        createdAt: new Date(),
      });

      // Section 2 — Registration
      await db.insert(schema.formSections).values({
        id: section2Id,
        formId,
        orderIndex: 1,
        title: "Registration",
        description: "",
        createdAt: new Date(),
      });

      const now = new Date();

      const templateElements = [
        // Section 1 Content Blocks
        {
          id: crypto.randomUUID(),
          formId,
          sectionId: section1Id,
          orderIndex: 0,
          type: "title_desc",
          title: "Event Date and Time",
          description: "",
          isRequired: false,
          points: 0,
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          formId,
          sectionId: section1Id,
          orderIndex: 1,
          type: "title_desc",
          title: "Event venue",
          description: "",
          isRequired: false,
          points: 0,
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          formId,
          sectionId: section1Id,
          orderIndex: 2,
          type: "image",
          title: "Event Poster",
          description: "",
          isRequired: false,
          points: 0,
          mediaUrl: null,
          mediaMeta: JSON.stringify({ alignment: "center", caption: "" }),
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          formId,
          sectionId: section1Id,
          orderIndex: 3,
          type: "title_desc",
          title: "Prizes",
          description: "",
          isRequired: false,
          points: 0,
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          formId,
          sectionId: section1Id,
          orderIndex: 4,
          type: "title_desc",
          title: "Organizer Contact",
          description: "",
          isRequired: false,
          points: 0,
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
        // Section 2 Attendee Questions
        {
          id: crypto.randomUUID(),
          formId,
          sectionId: section2Id,
          orderIndex: 5,
          type: "short_answer",
          title: "Enter your full name",
          description: "",
          isRequired: true,
          points: 0,
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          formId,
          sectionId: section2Id,
          orderIndex: 6,
          type: "short_answer",
          title: "Enter your email ID",
          description: "",
          isRequired: true,
          points: 0,
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          formId,
          sectionId: section2Id,
          orderIndex: 7,
          type: "dropdown",
          title: "Select your department",
          description: "",
          isRequired: true,
          points: 0,
          options: JSON.stringify([
            { id: "opt_1", text: "School of Design" },
            { id: "opt_2", text: "School of Engineering" },
            { id: "opt_3", text: "School of Management" },
            { id: "opt_4", text: "School of Law & Public Policy" },
            { id: "opt_5", text: "School of Psychology" },
            { id: "opt_6", text: "School of Agriculture" },
          ]),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          formId,
          sectionId: section2Id,
          orderIndex: 8,
          type: "short_answer",
          title: "Enter your enrollment no.",
          description: "",
          isRequired: true,
          points: 0,
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const el of templateElements) {
        await db.insert(schema.formElements).values(el);
      }

      return reply.status(201).send({
        id: formId,
        publicId,
        title: templateTitle,
        status: "draft",
      });
    }

    // Course Feedback Template Initialization
    if (data.template === "course_feedback") {
      const templateTitle = "Course Feedback";
      const templateDescription = "";

      await db.insert(schema.forms).values({
        id: formId,
        publicId,
        ownerId: authData.user.id,
        title: templateTitle,
        description: templateDescription,
        status: "draft",
        isQuiz: false,
        formSettings: JSON.stringify({
          collectEmail: false,
          requireCollegeLogin: true, // Restrict to Avantika University accounts: ON
          limitOneResponse: true,    // Limit to 1 response: ON
          shuffleQuestions: false,
          showProgressBar: true,
          allowEditResponse: false,
          allowViewSummary: false,
          confirmationMessage: "Your response has been recorded. Thank you!",
          submitAnotherLink: false,
          acceptingResponses: true,
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const sectionId = crypto.randomUUID();
      await db.insert(schema.formSections).values({
        id: sectionId,
        formId,
        orderIndex: 0,
        title: "",
        description: "",
        createdAt: new Date(),
      });

      const now = new Date();
      const templateElements = [
        // Block 2 – Student Name
        {
          id: crypto.randomUUID(),
          formId,
          sectionId,
          orderIndex: 0,
          type: "short_answer",
          title: "Enter your full name",
          description: "",
          isRequired: true,
          points: 0,
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
        // Block 3 – Overall Course Content Rating
        {
          id: crypto.randomUUID(),
          formId,
          sectionId,
          orderIndex: 1,
          type: "rating",
          title: "How would you rate the overall quality of the course content?",
          description: "",
          isRequired: true,
          points: 0,
          options: "[]",
          scaleSettings: JSON.stringify({ max: 5, icon: "star" }),
          createdAt: now,
          updatedAt: now,
        },
        // Block 4 – Teaching Pace Rating
        {
          id: crypto.randomUUID(),
          formId,
          sectionId,
          orderIndex: 2,
          type: "rating",
          title: "Was the pace of teaching appropriate for understanding the topics?",
          description: "",
          isRequired: true,
          points: 0,
          options: "[]",
          scaleSettings: JSON.stringify({ max: 5, icon: "star" }),
          createdAt: now,
          updatedAt: now,
        },
        // Block 5 – Assignment Feedback Rating
        {
          id: crypto.randomUUID(),
          formId,
          sectionId,
          orderIndex: 3,
          type: "rating",
          title: "Did you receive useful feedback on your assignments and performance?",
          description: "",
          isRequired: true,
          points: 0,
          options: "[]",
          scaleSettings: JSON.stringify({ max: 5, icon: "star" }),
          createdAt: now,
          updatedAt: now,
        },
        // Block 6 – Syllabus Completion
        {
          id: crypto.randomUUID(),
          formId,
          sectionId,
          orderIndex: 4,
          type: "multiple_choice",
          title: "Was the syllabus completed within the scheduled academic timeline?",
          description: "",
          isRequired: true,
          points: 0,
          options: JSON.stringify([
            { id: "opt_1", text: "Yes" },
            { id: "opt_2", text: "No" },
            { id: "opt_3", text: "Partially" },
          ]),
          createdAt: now,
          updatedAt: now,
        },
        // Block 7 – Overall Course Experience
        {
          id: crypto.randomUUID(),
          formId,
          sectionId,
          orderIndex: 5,
          type: "rating",
          title: "How satisfied are you with the overall course experience?",
          description: "",
          isRequired: true,
          points: 0,
          options: "[]",
          scaleSettings: JSON.stringify({ max: 5, icon: "star" }),
          createdAt: now,
          updatedAt: now,
        },
        // Block 8 – Additional Comments
        {
          id: crypto.randomUUID(),
          formId,
          sectionId,
          orderIndex: 6,
          type: "paragraph",
          title: "Any comments?",
          description: "",
          isRequired: false,
          points: 0,
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const el of templateElements) {
        await db.insert(schema.formElements).values(el);
      }

      return reply.status(201).send({
        id: formId,
        publicId,
        title: templateTitle,
        status: "draft",
        isQuiz: false,
      });
    }

    // Graded Quiz Template Initialization
    if (data.template === "graded_quiz") {
      const templateTitle = "Graded Quiz";
      const templateDescription = "";

      await db.insert(schema.forms).values({
        id: formId,
        publicId,
        ownerId: authData.user.id,
        title: templateTitle,
        description: templateDescription,
        status: "draft",
        isQuiz: true, // Make this a quiz: ON
        formSettings: JSON.stringify({
          collectEmail: false,
          requireCollegeLogin: true, // Restrict to Avantika University accounts: ON
          limitOneResponse: true,    // Limit to 1 response: ON
          shuffleQuestions: false,
          showProgressBar: true,
          allowEditResponse: false,
          allowViewSummary: false,
          confirmationMessage: "Your response has been recorded. Thank you!",
          submitAnotherLink: false,
          acceptingResponses: true,
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const sectionId = crypto.randomUUID();
      await db.insert(schema.formSections).values({
        id: sectionId,
        formId,
        orderIndex: 0,
        title: "",
        description: "",
        createdAt: new Date(),
      });

      const now = new Date();
      const templateElements = [
        // Block 2 – Student Name
        {
          id: crypto.randomUUID(),
          formId,
          sectionId,
          orderIndex: 0,
          type: "short_answer",
          title: "Enter your full name",
          description: "",
          isRequired: true,
          points: 0,
          options: "[]",
          createdAt: now,
          updatedAt: now,
        },
        // Block 3 – First Quiz Question
        {
          id: crypto.randomUUID(),
          formId,
          sectionId,
          orderIndex: 1,
          type: "multiple_choice",
          title: "Question",
          description: "",
          isRequired: false,
          points: 0, // No arbitrary marks assigned; creator configures marks & answer key
          quizAnswerKey: null,
          options: JSON.stringify([
            { id: "opt_1", text: "Option 1" },
            { id: "opt_2", text: "Option 2" },
            { id: "opt_3", text: "Option 3" },
            { id: "opt_4", text: "Option 4" },
          ]),
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const el of templateElements) {
        await db.insert(schema.formElements).values(el);
      }

      return reply.status(201).send({
        id: formId,
        publicId,
        title: templateTitle,
        status: "draft",
        isQuiz: true,
      });
    }
    const sectionId = crypto.randomUUID();
    const elementId = crypto.randomUUID();

    // Insert Form as a private draft
    await db.insert(schema.forms).values({
      id: formId,
      publicId,
      ownerId: authData.user.id,
      title: data.title,
      description: data.description,
      status: "draft",
      isQuiz: data.isQuiz,
      formSettings: JSON.stringify({
        collectEmail: false,
        requireCollegeLogin: false,
        limitOneResponse: false,
        shuffleQuestions: false,
        showProgressBar: true,
        allowEditResponse: false,
        allowViewSummary: false,
        confirmationMessage: "Your response has been recorded. Thank you!",
        submitAnotherLink: true,
        acceptingResponses: true,
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Initial Section (title optional)
    await db.insert(schema.formSections).values({
      id: sectionId,
      formId,
      orderIndex: 0,
      title: "",
      description: "",
      createdAt: new Date(),
    });

    // Create First Default Question (Short Answer)
    await db.insert(schema.formElements).values({
      id: elementId,
      formId,
      sectionId,
      orderIndex: 0,
      type: "short_answer",
      title: "",
      description: "",
      isRequired: false,
      points: data.isQuiz ? 1 : 0,
      options: "[]",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return reply.status(201).send({
      id: formId,
      publicId,
      title: data.title,
      status: "draft",
    });
  });

  // 3. Get single form with sections and elements (for editor)
  fastify.get("/api/forms/:id", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };

    const formRecords = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (formRecords.length === 0) {
      return reply.status(404).send({ error: "Form not found or you lack permission to view it." });
    }

    const form = formRecords[0];

    // Fetch Sections
    const sections = await db
      .select()
      .from(schema.formSections)
      .where(eq(schema.formSections.formId, id))
      .orderBy(schema.formSections.orderIndex);

    // Fetch Elements
    const elements = await db
      .select()
      .from(schema.formElements)
      .where(eq(schema.formElements.formId, id))
      .orderBy(schema.formElements.orderIndex);

    // Response count
    const responseCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.formResponses)
      .where(eq(schema.formResponses.formId, id));

    return reply.send({
      ...form,
      sections,
      elements,
      responseCount: responseCount[0]?.count || 0,
    });
  });

  // 4. Update Form details and settings
  fastify.put("/api/forms/:id", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };

    const formRecords = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (formRecords.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    const body = request.body as any;

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.themeSettings !== undefined) {
      updateData.themeSettings = typeof body.themeSettings === "string" ? body.themeSettings : JSON.stringify(body.themeSettings);
    }
    if (body.formSettings !== undefined) {
      updateData.formSettings = typeof body.formSettings === "string" ? body.formSettings : JSON.stringify(body.formSettings);
    }
    if (body.isQuiz !== undefined) updateData.isQuiz = Boolean(body.isQuiz);
    if (body.quizSettings !== undefined) {
      updateData.quizSettings = typeof body.quizSettings === "string" ? body.quizSettings : JSON.stringify(body.quizSettings);
    }
    if (body.opensAt !== undefined) {
      updateData.opensAt = body.opensAt ? new Date(body.opensAt) : null;
    }
    if (body.closesAt !== undefined) {
      updateData.closesAt = body.closesAt ? new Date(body.closesAt) : null;
    }
    if (body.maxResponses !== undefined) {
      updateData.maxResponses = body.maxResponses ? parseInt(body.maxResponses, 10) : null;
    }

    await db.update(schema.forms).set(updateData).where(eq(schema.forms.id, id));

    return reply.send({ success: true, message: "Form updated successfully." });
  });

  // 5. Batch update form layout (Sections and Elements)
  fastify.put("/api/forms/:id/layout", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };

    const formRecords = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (formRecords.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    const body = request.body as {
      sections: Array<{
        id: string;
        title: string;
        description?: string;
        orderIndex: number;
      }>;
      elements: Array<{
        id: string;
        sectionId: string;
        orderIndex: number;
        type: string;
        title: string;
        description?: string;
        isRequired?: boolean;
        points?: number;
        options?: any;
        scaleSettings?: any;
        validation?: any;
        branchingLogic?: any;
        mediaUrl?: string;
        mediaMeta?: any;
        quizAnswerKey?: any;
      }>;
    };

    if (!body || !Array.isArray(body.sections) || !Array.isArray(body.elements)) {
      return reply.status(400).send({ error: "Invalid layout payload format." });
    }

    // Upsert or replace sections & elements
    // Delete sections that are no longer in the payload
    const existingSections = await db
      .select({ id: schema.formSections.id })
      .from(schema.formSections)
      .where(eq(schema.formSections.formId, id));

    const incomingSectionIds = new Set(body.sections.map((s) => s.id));
    for (const es of existingSections) {
      if (!incomingSectionIds.has(es.id)) {
        await db.delete(schema.formSections).where(eq(schema.formSections.id, es.id));
      }
    }

    // Upsert sections
    for (const sec of body.sections) {
      const exists = existingSections.some((es) => es.id === sec.id);
      if (exists) {
        await db
          .update(schema.formSections)
          .set({
            title: sec.title,
            description: sec.description || "",
            orderIndex: sec.orderIndex,
          })
          .where(eq(schema.formSections.id, sec.id));
      } else {
        await db.insert(schema.formSections).values({
          id: sec.id || crypto.randomUUID(),
          formId: id,
          title: sec.title,
          description: sec.description || "",
          orderIndex: sec.orderIndex,
          createdAt: new Date(),
        });
      }
    }

    // Delete elements not in incoming payload
    const existingElements = await db
      .select({ id: schema.formElements.id })
      .from(schema.formElements)
      .where(eq(schema.formElements.formId, id));

    const incomingElementIds = new Set(body.elements.map((e) => e.id));
    for (const ee of existingElements) {
      if (!incomingElementIds.has(ee.id)) {
        await db.delete(schema.formElements).where(eq(schema.formElements.id, ee.id));
      }
    }

    // Upsert elements
    for (const el of body.elements) {
      const exists = existingElements.some((ee) => ee.id === el.id);
      const values: any = {
        sectionId: el.sectionId,
        orderIndex: el.orderIndex,
        type: el.type,
        title: el.title,
        description: el.description || "",
        isRequired: Boolean(el.isRequired),
        points: el.points || 0,
        options: typeof el.options === "string" ? el.options : JSON.stringify(el.options || []),
        scaleSettings: el.scaleSettings ? (typeof el.scaleSettings === "string" ? el.scaleSettings : JSON.stringify(el.scaleSettings)) : null,
        validation: null,
        branchingLogic: el.branchingLogic ? (typeof el.branchingLogic === "string" ? el.branchingLogic : JSON.stringify(el.branchingLogic)) : null,
        mediaUrl: el.mediaUrl || null,
        mediaMeta: el.mediaMeta ? (typeof el.mediaMeta === "string" ? el.mediaMeta : JSON.stringify(el.mediaMeta)) : null,
        quizAnswerKey: el.quizAnswerKey ? (typeof el.quizAnswerKey === "string" ? el.quizAnswerKey : JSON.stringify(el.quizAnswerKey)) : null,
        updatedAt: new Date(),
      };

      if (exists) {
        await db.update(schema.formElements).set(values).where(eq(schema.formElements.id, el.id));
      } else {
        await db.insert(schema.formElements).values({
          id: el.id || crypto.randomUUID(),
          formId: id,
          createdAt: new Date(),
          ...values,
        });
      }
    }

    // Update form's updatedAt timestamp
    await db.update(schema.forms).set({ updatedAt: new Date() }).where(eq(schema.forms.id, id));

    return reply.send({ success: true, message: "Form layout saved successfully." });
  });

  // 6. Duplicate Form
  fastify.post("/api/forms/:id/duplicate", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };

    const originalForm = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (originalForm.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    const orig = originalForm[0];
    const newFormId = crypto.randomUUID();
    const newPublicId = generatePublicId();

    // Insert cloned form
    await db.insert(schema.forms).values({
      id: newFormId,
      publicId: newPublicId,
      ownerId: authData.user.id,
      title: `Copy of ${orig.title}`,
      description: orig.description,
      status: "draft", // Always starts as draft
      themeSettings: orig.themeSettings,
      formSettings: orig.formSettings,
      isQuiz: orig.isQuiz,
      quizSettings: orig.quizSettings,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Clone sections and map old section IDs to new section IDs
    const origSections = await db
      .select()
      .from(schema.formSections)
      .where(eq(schema.formSections.formId, id))
      .orderBy(schema.formSections.orderIndex);

    const sectionIdMap: Record<string, string> = {};

    for (const sec of origSections) {
      const newSecId = crypto.randomUUID();
      sectionIdMap[sec.id] = newSecId;
      await db.insert(schema.formSections).values({
        id: newSecId,
        formId: newFormId,
        orderIndex: sec.orderIndex,
        title: sec.title,
        description: sec.description,
        createdAt: new Date(),
      });
    }

    // Clone elements
    const origElements = await db
      .select()
      .from(schema.formElements)
      .where(eq(schema.formElements.formId, id))
      .orderBy(schema.formElements.orderIndex);

    for (const el of origElements) {
      const newElId = crypto.randomUUID();
      const mappedSecId = sectionIdMap[el.sectionId] || Object.values(sectionIdMap)[0];
      await db.insert(schema.formElements).values({
        id: newElId,
        formId: newFormId,
        sectionId: mappedSecId,
        orderIndex: el.orderIndex,
        type: el.type,
        title: el.title,
        description: el.description,
        isRequired: el.isRequired,
        points: el.points,
        options: el.options,
        scaleSettings: el.scaleSettings,
        validation: el.validation,
        branchingLogic: el.branchingLogic,
        mediaUrl: el.mediaUrl,
        mediaMeta: el.mediaMeta,
        quizAnswerKey: el.quizAnswerKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return reply.status(201).send({
      id: newFormId,
      publicId: newPublicId,
      title: `Copy of ${orig.title}`,
    });
  });

  // 7. Delete Form
  fastify.delete("/api/forms/:id", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };

    try {
      // 1. Check if form exists
      const existingForms = await db
        .select()
        .from(schema.forms)
        .where(eq(schema.forms.id, id))
        .limit(1);

      if (existingForms.length === 0) {
        return reply.status(404).send({ error: "Form not found. It may have already been deleted." });
      }

      const form = existingForms[0];

      // 2. Verify ownership (only form owner can delete)
      if (form.ownerId !== authData.user.id) {
        return reply.status(403).send({ error: "Unauthorized. Only the form owner can delete this form." });
      }

      // 3. Clean up exclusive uploaded media files & records (ensures no orphaned files on disk or Cloudinary)
      const cleanedMediaCount = await cleanupFormExclusiveMedia(id);

      // 4. Clean up dependent records safely to prevent orphaned rows across any SQLite configuration
      // A. Delete all answers for responses belonging to this form
      const responses = await db
        .select({ id: schema.formResponses.id })
        .from(schema.formResponses)
        .where(eq(schema.formResponses.formId, id));

      for (const r of responses) {
        await db.delete(schema.formAnswers).where(eq(schema.formAnswers.responseId, r.id));
      }

      // B. Delete responses
      await db.delete(schema.formResponses).where(eq(schema.formResponses.formId, id));

      // C. Delete questions and content elements
      await db.delete(schema.formElements).where(eq(schema.formElements.formId, id));

      // D. Delete sections
      await db.delete(schema.formSections).where(eq(schema.formSections.formId, id));

      // E. Delete collaborators
      await db.delete(schema.formCollaborators).where(eq(schema.formCollaborators.formId, id));

      // F. Delete audit logs associated with this form
      await db
        .delete(schema.auditLogs)
        .where(and(eq(schema.auditLogs.entityType, "form"), eq(schema.auditLogs.entityId, id)));

      // G. Delete the form record
      await db.delete(schema.forms).where(eq(schema.forms.id, id));

      return reply.send({
        success: true,
        message: "Form and all associated records deleted successfully.",
        cleanedMediaCount,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Failed to delete form: " + err.message });
    }
  });

  // 8. Publish Form (Transitions Draft -> Published & enables response collection)
  fastify.post("/api/forms/:id/publish", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };

    const formRecords = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (formRecords.length === 0) {
      return reply.status(404).send({ error: "Form not found or you lack permission to publish it." });
    }

    const form = formRecords[0];

    // Validate minimum requirements for publication
    if (!form.title || form.title.trim().length === 0) {
      return reply.status(400).send({ error: "Cannot publish: Form must have a non-empty title." });
    }

    const elements = await db
      .select({
        id: schema.formElements.id,
        type: schema.formElements.type,
        title: schema.formElements.title,
        options: schema.formElements.options,
      })
      .from(schema.formElements)
      .where(eq(schema.formElements.formId, id));

    const questionCount = elements.filter(
      (el) => !["title_desc", "image", "video"].includes(el.type)
    ).length;

    if (questionCount === 0) {
      return reply.status(400).send({ error: "Cannot publish: Form must contain at least one question." });
    }

    // Validate choice-based and grid questions have valid options
    for (const el of elements) {
      const qTitle = (el.title || "Untitled Question").replace(/<[^>]*>/g, "").trim();
      if (["multiple_choice", "checkboxes", "dropdown"].includes(el.type)) {
        let opts: any[] = [];
        try {
          opts = typeof el.options === "string" ? JSON.parse(el.options || "[]") : el.options || [];
        } catch {
          opts = [];
        }
        const validOpts = Array.isArray(opts) ? opts.filter((o) => o?.text && String(o.text).trim().length > 0) : [];
        if (validOpts.length === 0) {
          return reply.status(400).send({
            error: `Cannot publish: Choice question "${qTitle}" must have at least one option with text.`,
          });
        }
      } else if (["mc_grid", "checkbox_grid"].includes(el.type)) {
        let grid: any = {};
        try {
          grid = typeof el.options === "string" ? JSON.parse(el.options || "{}") : el.options || {};
        } catch {
          grid = {};
        }
        const rows = Array.isArray(grid.rows) ? grid.rows.filter((r: any) => r?.text && String(r.text).trim().length > 0) : [];
        const cols = Array.isArray(grid.columns) ? grid.columns.filter((c: any) => c?.text && String(c.text).trim().length > 0) : [];
        if (rows.length === 0 || cols.length === 0) {
          return reply.status(400).send({
            error: `Cannot publish: Grid question "${qTitle}" must have at least one row and one column with text.`,
          });
        }
      }
    }

    let formSettings: any = {};
    try {
      formSettings = JSON.parse(form.formSettings || "{}");
    } catch {
      formSettings = {};
    }
    formSettings.acceptingResponses = true;

    await db
      .update(schema.forms)
      .set({
        status: "published",
        formSettings: JSON.stringify(formSettings),
        updatedAt: new Date(),
      })
      .where(eq(schema.forms.id, id));

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const publicUrl = `${frontendUrl}/forms/${form.publicId}`;

    return reply.send({
      success: true,
      message: "Form published successfully.",
      status: "published",
      publicId: form.publicId,
      publicUrl,
      acceptingResponses: true,
    });
  });

  // 9. Unpublish Form (Transitions Published -> Draft)
  fastify.post("/api/forms/:id/unpublish", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };

    const formRecords = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (formRecords.length === 0) {
      return reply.status(404).send({ error: "Form not found or unauthorized." });
    }

    await db
      .update(schema.forms)
      .set({
        status: "draft",
        updatedAt: new Date(),
      })
      .where(eq(schema.forms.id, id));

    return reply.send({
      success: true,
      message: "Form unpublished and reverted to draft.",
      status: "draft",
    });
  });

  // 10. Toggle Response Collection Status (Accepting Responses / Closed)
  fastify.post("/api/forms/:id/toggle-responses", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { accepting?: boolean; acceptingResponses?: boolean; closedMessage?: string };

    const formRecords = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (formRecords.length === 0) {
      return reply.status(404).send({ error: "Form not found or unauthorized." });
    }

    const form = formRecords[0];

    let formSettings: any = {};
    try {
      formSettings = JSON.parse(form.formSettings || "{}");
    } catch {
      formSettings = {};
    }

    const currentAccepting = formSettings.acceptingResponses !== false;
    let targetAccepting: boolean;
    if (body.accepting !== undefined) {
      targetAccepting = Boolean(body.accepting);
    } else if (body.acceptingResponses !== undefined) {
      targetAccepting = Boolean(body.acceptingResponses);
    } else {
      targetAccepting = !currentAccepting;
    }

    // If attempting to reopen, verify that closing deadline has not already passed
    if (targetAccepting && form.closesAt && new Date(form.closesAt) < new Date()) {
      return reply.status(400).send({
        error: "Cannot reopen form: the scheduled closing deadline has already passed. Please update the closing time in Settings first.",
      });
    }

    formSettings.acceptingResponses = targetAccepting;
    if (body.closedMessage !== undefined) {
      formSettings.closedMessage = body.closedMessage;
    }

    // Preserve publication status as 'published' (or migrate legacy 'closed' -> 'published')
    const nextStatus = form.status === "draft" ? "draft" : "published";

    await db
      .update(schema.forms)
      .set({
        status: nextStatus,
        formSettings: JSON.stringify(formSettings),
        updatedAt: new Date(),
      })
      .where(eq(schema.forms.id, id));

    return reply.send({
      success: true,
      acceptingResponses: targetAccepting,
      status: nextStatus,
      message: targetAccepting ? "Form is now accepting responses." : "Form is now closed to new responses.",
    });
  });

  // 11. Maintenance: Trigger database cleanup of expired authentication & temporary records
  fastify.post("/api/maintenance/cleanup", async (request, reply) => {
    const maintenanceToken = request.headers["x-maintenance-token"] as string | undefined;
    const expectedToken = process.env.MAINTENANCE_TOKEN || process.env.BETTER_AUTH_SECRET;

    let authorized = false;
    if (maintenanceToken && expectedToken && maintenanceToken === expectedToken) {
      authorized = true;
    } else {
      const authData = await requireAuth(request, reply);
      if (!authData) return;
      // In development or if user is admin, allow cleanup
      if (authData.user.role === "admin" || process.env.NODE_ENV !== "production") {
        authorized = true;
      }
    }

    if (!authorized) {
      return reply.status(403).send({ error: "Unauthorized: Admin privileges or maintenance token required" });
    }

    try {
      const stats = await cleanupExpiredAuthRecords();
      return reply.send({
        success: true,
        message: "Maintenance cleanup completed successfully.",
        stats,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Failed to run maintenance cleanup: " + err.message });
    }
  });
}
