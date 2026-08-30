import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { tutorConversationsTable, tutorMessagesTable, userModulesTable } from "@workspace/db";
import { desc, eq, count, and } from "drizzle-orm";
import { MODULE_CATALOG } from "../lib/moduleCatalog";
import { openai, TUTOR_MODEL } from "@workspace/integrations-openai-ai-server";
import {
  CreateTutorConversationBody,
  GetTutorConversationParams,
  SendTutorMessageBody,
  SendTutorMessageParams,
} from "@workspace/api-zod";

const router = Router();

const STAGE_DETAILS: Record<string, { label: string; goal: string; questions: string[] }> = {
  idea: {
    label: "Idea",
    goal: "Clarify what the student wants to build, whether it is achievable, and who it is for.",
    questions: [
      "What exactly do you want to create? Be specific — a vague idea leads to a vague robot.",
      "Who will use this? What is the concrete problem it solves for them?",
      "Is the end goal actually achievable with a Pico W and EcoBot modules, given the student's skill level?",
    ],
  },
  hardware: {
    label: "Hardware",
    goal: "Identify which EcoBot modules and components are needed, check they exist, discuss alternatives and cost.",
    questions: [
      "Which EcoBot modules are needed to implement each function of the idea?",
      "Do all required parts exist in the EcoBot catalog, or does the student need external components?",
      "What is the rough total cost (modules + chassis + wiring)? Is there a cheaper alternative for any part?",
    ],
  },
  software: {
    label: "Software",
    goal: "Identify the MicroPython commands, functions, and code structure the student will need — before writing a line.",
    questions: [
      "What MicroPython libraries or imports does each module require?",
      "What is the high-level code structure — event loop, interrupts, polling?",
      "Which parts of the code will the student find hardest? Have they used I2C or PWM before?",
    ],
  },
  chassis: {
    label: "Chassis",
    goal: "Choose and evaluate the physical chassis — durability, space, weight capacity, and component fit.",
    questions: [
      "What physical form does the chassis need — wheeled, stationary, handheld, wearable?",
      "Is it durable enough to survive testing? Plastic, wood, acrylic, 3D-printed?",
      "Can all modules physically fit with clearance for magnetic connectors? Is there room for a battery and wiring?",
    ],
  },
  prototype: {
    label: "Prototype",
    goal: "Plan and execute the physical build — wiring order, component placement, and first working version.",
    questions: [
      "In what order should components be connected and tested?",
      "How are modules arranged on the PCB base for best fit and wire routing?",
      "What is the smallest build that proves the core idea works before completing the full assembly?",
    ],
  },
  debug: {
    label: "Debug",
    goal: "Test the prototype, identify failures, isolate root causes, and iterate toward a working system.",
    questions: [
      "What happened versus what was expected? Be specific — vague 'it doesn't work' is not a bug report.",
      "Have you isolated whether the issue is hardware (wiring, power) or software (logic, timing)?",
      "What is the smallest test that would confirm or rule out the suspected cause?",
    ],
  },
  product: {
    label: "Product",
    goal: "Evaluate the finished creation as a real product — polish, user experience, and potential improvements.",
    questions: [
      "How does it feel to use? Where does it frustrate or confuse someone who didn't build it?",
      "What is the single most impactful improvement you could make right now?",
      "What would you add or change if you had two more weeks?",
    ],
  },
};

function buildStageGuidance(stage: string): string {
  const s = STAGE_DETAILS[stage] ?? STAGE_DETAILS["idea"]!;
  return `## ACTIVE STAGE: ${s.label.toUpperCase()}
Goal: ${s.goal}
Key questions to drive this stage:
${s.questions.map((q) => `• ${q}`).join("\n")}

If the student asks what stage they are on or what it means, explain it in plain language. Example: "You're in the ${s.label} stage — ${s.goal.toLowerCase()}"`;
}

function getSystemPrompt(stage: string): string {
  return `You are the EcoBot Design Coach — a direct, knowledgeable robotics mentor for young engineers aged 8–16 building real robots with the EcoBot system (Raspberry Pi Pico W + modular PCB sensors).

## YOUR PERSONALITY
- Fact-based and critical, not a yes-man. Hardware problems that go unchallenged ruin projects.
- When a student's plan has a real flaw (wrong module, budget blowout, chassis too small, code approach that won't work), say so clearly and briefly. "That won't work because X" is kinder than letting them find out at the bench.
- Encouraging about effort and progress, not about every single thing they say.
- No filler praise ("Great idea!", "Awesome!", "That's amazing!"). Acknowledge real progress with one specific sentence, then move on.
- Ask exactly ONE focused question per response. Not two. Not three. One.
- Keep responses to 3–5 sentences. Kids lose focus fast.
- If a student tries to skip a stage, redirect them briefly and explain why the skipped stage matters.

## THE 7-STAGE ECOBOT ENGINEERING WORKFLOW
Students move through these stages in order. You must know what each stage is about and be able to explain it if asked.

1. IDEA — What's the idea? Is it achievable? What is the user's end goal?
2. HARDWARE — What parts are needed? Do they exist in the EcoBot catalog? What are the alternatives and costs?
3. SOFTWARE — What MicroPython commands and functions does this project need? What is the basic code structure?
4. CHASSIS — What chassis are we using? Is it durable enough? Can it carry the components' weight? Is there enough space?
5. PROTOTYPE — How do we wire the components? How are they arranged in the chassis? What are the step-by-step build steps?
6. DEBUG — Testing and refining. What failed and why? How do we isolate the problem? How do we improve what works?
7. PRODUCT — How do we make it better? New features? What is the user experience when handling the finished creation?

## ECOBOT DESIGN DECISION FLOWCHART
This is the specific decision process students follow when designing their project. Use this as a mental model for coaching — push students through each gate before moving on.

IDEA GATE — Before anything else:
  → "What do I want to create?" (must be specific)
  → "Do the parts exist?" — if No, revisit the idea
  → "Will I be able to code it?" — if No, simplify the idea or plan to learn the skill

CHASSIS GATE — Once the idea is validated:
  → "Choose my chassis"
  → "Is it durable enough?" — if No, choose a different chassis
  → "Enough space for all modules?" — if No, choose a different chassis
  → Both Yes → check "Weight constraint?" — can the chassis carry everything?

HARDWARE GATE — After chassis is chosen:
  → "What part models should I buy?"
  → "Are they provided by EcoBot?" — if No, loop back to find alternatives that are
  → "Does it fit within my budget?"
  → If over budget → "Can I acquire or make an alternative?" — if No, back to the start; if Yes, re-check budget
  → Budget OK → move to planning

BUILD PLANNING GATE — Before physical assembly:
  → "Plan out the build process" — step by step order of assembly
  → "Does it make sense and is it efficient?" — if No, revise the plan; if Yes, begin
  → "Begin design process" → prototype, test, iterate

When coaching, use these decision gates to check whether a student has actually answered each question before moving them forward. If they skip a gate, point it out directly: e.g. "You haven't checked if the chassis has enough space for the motor controller and the Pico W — that's a real risk. Can it fit?"

${buildStageGuidance(stage)}

## ECOBOTS OS — THE CORE LIBRARY
Every EcoBot project MUST start with:
  from ecobot_os import EcoBotOS
  bot = EcoBotOS()

EcoBotOS is pre-loaded on every Pico W — students do NOT need to install it. This is the ONLY correct import. Never tell a student to import machine, PWM, Pin, or I2C directly — EcoBotOS handles all of that internally.

### Motors (bot.m1 – bot.m4)
  bot.m1.spin(speed)   # speed: -100 (full reverse) to 100 (full forward), 0 = stop
  bot.m2.spin(-50)     # half speed backward
  bot.m3.spin(75)
  bot.m4.spin(0)       # stop

- m1 & m2 → first motor driver board (Motor A and B)
- m3 & m4 → second motor driver board (always two boards minimum on the PCBA)
- speed is clamped automatically to [-100, 100]
- PWM duty is derived from |speed| / 100 × 65535

### Sensors (bot.s1 – bot.s8)
Currently only s1 is active — bound to the ultrasonic module (I2C address 0x08).
s2–s8 are reserved for future module types. If a student tries to use s2–s8, warn them it's not available yet.

  bot.s1.read()        # returns int — distance in mm (default)
  bot.s1.read(bool)    # True if distance < 200 mm (something is close)
  bot.s1.read(str)     # returns "Xmm" as a string

Returns None if no module is plugged in (OSError caught internally).

### How the hardware works
- All sensor modules share a single I2C bus (SDA=GP4, SCL=GP5). Each module type has its own fixed I2C address burned into its STM32 firmware — the Pico cannot tell which physical port a module is in, only which address responded.
- "s1" means "first known sensor type" (ultrasonic), NOT "port 1".
- Plug any module into any open port — it will be found by its address.

### Common mistakes to catch
- Using "import machine" or "from machine import Pin" directly — wrong, EcoBotOS handles this
- Calling bot.s2 through bot.s8 — currently None, will crash
- Passing speed values outside -100 to 100 (it clamps, but shows the student the real range)
- Forgetting bot = EcoBotOS() before using bot.m1 or bot.s1

## MICROPYTHON NOTES
Pico W runs MicroPython. Additional imports students may legitimately use: time, network, uasyncio. Ask about coding experience before going into syntax depth. Never write the student's code — show a short syntax stub only if they are completely stuck on syntax, never on logic.`;
}

// GET /api/tutor/conversations
router.get("/tutor/conversations", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const conversations = await db
    .select()
    .from(tutorConversationsTable)
    .where(eq(tutorConversationsTable.userId, userId))
    .orderBy(desc(tutorConversationsTable.updatedAt));

  const withCounts = await Promise.all(
    conversations.map(async (conv) => {
      const [{ count: msgCount }] = await db
        .select({ count: count() })
        .from(tutorMessagesTable)
        .where(eq(tutorMessagesTable.conversationId, conv.id));
      return {
        id: conv.id,
        title: conv.title,
        projectId: conv.projectId,
        workflowStage: conv.workflowStage,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        messageCount: Number(msgCount),
      };
    })
  );

  res.json(withCounts);
});

// POST /api/tutor/conversations
router.post("/tutor/conversations", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreateTutorConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [conv] = await db
    .insert(tutorConversationsTable)
    .values({
      userId,
      title: parsed.data.title,
      projectId: parsed.data.projectId ?? null,
      workflowStage: parsed.data.workflowStage ?? "idea",
    })
    .returning();
  res.status(201).json({
    id: conv.id,
    title: conv.title,
    projectId: conv.projectId,
    workflowStage: conv.workflowStage,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messageCount: 0,
  });
});

// GET /api/tutor/conversations/:id
router.get("/tutor/conversations/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = GetTutorConversationParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [conv] = await db
    .select()
    .from(tutorConversationsTable)
    .where(and(eq(tutorConversationsTable.id, parsed.data.id), eq(tutorConversationsTable.userId, userId)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const messages = await db
    .select()
    .from(tutorMessagesTable)
    .where(eq(tutorMessagesTable.conversationId, conv.id))
    .orderBy(tutorMessagesTable.createdAt);

  res.json({
    id: conv.id,
    title: conv.title,
    projectId: conv.projectId,
    workflowStage: conv.workflowStage,
    createdAt: conv.createdAt.toISOString(),
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

// PATCH /api/tutor/conversations/:id — rename or update stage
router.patch("/tutor/conversations/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title, workflowStage } = req.body as { title?: string; workflowStage?: string };

  const patch: Partial<typeof tutorConversationsTable.$inferInsert> & { updatedAt?: Date } = {
    updatedAt: new Date(),
  };
  if (title !== undefined) patch.title = title.trim().slice(0, 200) || "Untitled";
  if (workflowStage !== undefined) patch.workflowStage = workflowStage;

  const [updated] = await db
    .update(tutorConversationsTable)
    .set(patch)
    .where(and(eq(tutorConversationsTable.id, id), eq(tutorConversationsTable.userId, userId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: updated.id, title: updated.title, workflowStage: updated.workflowStage });
});

// DELETE /api/tutor/conversations/:id — delete conversation and messages
router.delete("/tutor/conversations/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [conv] = await db.select().from(tutorConversationsTable).where(
    and(eq(tutorConversationsTable.id, id), eq(tutorConversationsTable.userId, userId))
  );
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(tutorMessagesTable).where(eq(tutorMessagesTable.conversationId, id));
  await db.delete(tutorConversationsTable).where(eq(tutorConversationsTable.id, id));
  res.json({ success: true });
});

// POST /api/tutor/conversations/:id/messages — SSE streaming
router.post("/tutor/conversations/:id/messages", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = SendTutorMessageParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = SendTutorMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const [conv] = await db
    .select()
    .from(tutorConversationsTable)
    .where(and(eq(tutorConversationsTable.id, params.data.id), eq(tutorConversationsTable.userId, userId)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // Save user message
  await db.insert(tutorMessagesTable).values({
    conversationId: conv.id,
    role: "user",
    content: body.data.content,
  });

  // Get conversation history
  const history = await db
    .select()
    .from(tutorMessagesTable)
    .where(eq(tutorMessagesTable.conversationId, conv.id))
    .orderBy(tutorMessagesTable.createdAt);

  const stage = body.data.workflowStage ?? conv.workflowStage ?? "idea";

  // Fetch user's owned modules for AI context
  let userModuleContext = "";
  if (userId) {
    const owned = await db
      .select()
      .from(userModulesTable)
      .where(eq(userModulesTable.userId, userId));
    if (owned.length > 0) {
      const moduleDetails = owned
        .map((m) => {
          const info = MODULE_CATALOG.find((c) => c.id === m.moduleId);
          if (!info) return `- ${m.moduleId}`;
          return `- ${info.displayName} (${info.model}) — ${info.group}: ${info.sensors.join(", ")}`;
        })
        .join("\n");
      userModuleContext = `\n\nThe student currently owns these EcoBot modules:\n${moduleDetails}\nTailor your guidance and component suggestions to prioritise these modules where applicable.`;
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  try {
    const stream = await openai.chat.completions.create({
      model: TUTOR_MODEL,
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: getSystemPrompt(stage) + userModuleContext },
        ...history.slice(0, -1).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: body.data.content },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Save assistant response
    await db.insert(tutorMessagesTable).values({
      conversationId: conv.id,
      role: "assistant",
      content: fullResponse,
    });

    // Update conversation timestamp
    await db
      .update(tutorConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(tutorConversationsTable.id, conv.id));

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

    // Stage-hint: quick separate call to determine if stage should change
    try {
      const stageOrder = ["idea", "hardware", "software", "chassis", "prototype", "debug", "product"];
      const currentIdx = stageOrder.indexOf(stage);
      const nextStage = stageOrder[currentIdx + 1] ?? null;
      const prevStage = stageOrder[currentIdx - 1] ?? null;

      const stageDescriptions = stageOrder.map((s) => `${s} (${STAGE_DETAILS[s]?.goal ?? ""})`).join("; ");

      const hintSystemPrompt = `You analyse a student-coach conversation and decide whether the student's design stage should change.
Current stage: "${stage}". Stage order: idea → hardware → software → chassis → prototype → debug → product.
Stages and their goals: ${stageDescriptions}
Reply with ONLY a JSON object, no explanation, no markdown:
{"action":"advance"|"stay"|"retreat","targetStage":"idea"|"hardware"|"software"|"chassis"|"prototype"|"debug"|"product","reason":"<≤8 words>"}
Rules:
- "advance" only if student has clearly completed the goals of the current stage (${stage === "product" ? "cannot advance past product" : `next would be: ${nextStage}`}).
- "retreat" only if student is clearly confused or working at a much earlier stage${prevStage ? ` (previous: ${prevStage})` : " (already at start — use stay)"}.
- "stay" in all other cases (default — when in doubt, stay).
- targetStage must always be a valid stage name from the list above.`;

      const recentHistory = history.slice(-6).map((m) => `${m.role === "user" ? "Student" : "Coach"}: ${m.content.slice(0, 300)}`).join("\n");
      const hintCompletion = await openai.chat.completions.create({
        model: TUTOR_MODEL,
        max_completion_tokens: 60,
        messages: [
          { role: "system", content: hintSystemPrompt },
          { role: "user", content: `Conversation:\n${recentHistory}\nCoach just said: ${fullResponse.slice(0, 400)}` },
        ],
      });
      const raw = hintCompletion.choices[0]?.message?.content ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const hint = JSON.parse(jsonMatch[0]) as { action: string; targetStage: string; reason: string };
        if (stageOrder.includes(hint.targetStage) && hint.action !== "stay") {
          res.write(`data: ${JSON.stringify({ stageHint: hint })}\n\n`);
        }
      }
    } catch { /* stage hint is non-critical — ignore errors */ }

  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "AI tutor unavailable" })}\n\n`);
  }

  res.end();
});

export default router;
