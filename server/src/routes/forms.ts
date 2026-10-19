import { FastifyInstance } from "fastify";
import { db, schema } from "../db/index.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
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

    // Get response count for each form
    const formsWithCounts = await Promise.all(
      userForms.map(async (form) => {
        const responseCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.formResponses)
          .where(eq(schema.formResponses.formId, form.id));
        return {
          ...form,
          responseCount: responseCount[0]?.count || 0,
        };
      })
    );

    let filtered = formsWithCounts;
    if (query.status && query.status !== "all") {
      filtered = filtered.filter((f) => f.status === query.status);
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
        published: formsWithCounts.filter((f) => f.status === "published").length,
        draft: formsWithCounts.filter((f) => f.status === "draft").length,
        closed: formsWithCounts.filter((f) => f.status === "closed").length,
        archived: formsWithCounts.filter((f) => f.status === "archived").length,
        totalResponses: formsWithCounts.reduce((acc, f) => acc + (f.responseCount || 0), 0),
      },
    });
  });

  // 2. Create new form
  fastify.post("/api/forms", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const bodySchema = z.object({
      title: z.string().default("Untitled Form"),
      description: z.string().default(""),
      isQuiz: z.boolean().default(false),
    });

    const parsed = bodySchema.safeParse(request.body || {});
    const data = parsed.success ? parsed.data : { title: "Untitled Form", description: "", isQuiz: false };

    const formId = crypto.randomUUID();
    const publicId = generatePublicId();
    const sectionId = crypto.randomUUID();
    const elementId = crypto.randomUUID();

    // Insert Form
    await db.insert(schema.forms).values({
      id: formId,
      publicId,
      ownerId: authData.user.id,
      title: data.title,
      description: data.description,
      status: "draft",
      isQuiz: data.isQuiz,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Initial Section
    await db.insert(schema.formSections).values({
      id: sectionId,
      formId,
      orderIndex: 0,
      title: "Untitled Section",
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
      title: "Untitled Question",
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
        validation: el.validation ? (typeof el.validation === "string" ? el.validation : JSON.stringify(el.validation)) : null,
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

    const form = await db
      .select()
      .from(schema.forms)
      .where(and(eq(schema.forms.id, id), eq(schema.forms.ownerId, authData.user.id)))
      .limit(1);

    if (form.length === 0) {
      return reply.status(404).send({ error: "Form not found or unauthorized." });
    }

    // Delete form (cascades to sections, elements, responses, answers)
    await db.delete(schema.forms).where(eq(schema.forms.id, id));

    return reply.send({ success: true, message: "Form deleted successfully." });
  });
}
