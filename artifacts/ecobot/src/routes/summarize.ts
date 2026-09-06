import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { tutorConversationsTable, tutorMessagesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { openai, TUTOR_MODEL } from "@workspace/integrations-openai-ai-server";

export const summarizeRouter = Router();

// POST /api/summarize/code
// Body: { code: string, projectName?: string }
// Returns: { summary: string }
summarizeRouter.post("/summarize/code", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { code, projectName } = req.body as { code?: string; projectName?: string };
  if (!code || typeof code !== "string" || !code.trim()) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const systemPrompt = `You are a friendly coding mentor for kids aged 8–16 learning MicroPython on a Raspberry Pi Pico W.
Summarise what the following code does in 2–3 short, simple sentences a child would understand. 
Focus on what the code DOES (behaviour, what it controls, what it outputs) — not on how it's structured.
Be encouraging and use plain language. Do not mention Python syntax details or code structure.
Reply with ONLY the summary text — no labels, no markdown, no headings.`;

  try {
    const completion = await openai.chat.completions.create({
      model: TUTOR_MODEL,
      max_completion_tokens: 150,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Sketch name: ${projectName ?? "Unnamed"}\n\nCode:\n\`\`\`python\n${code.slice(0, 3000)}\n\`\`\``,
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? "No summary available.";
    res.json({ summary });
  } catch {
    res.status(500).json({ error: "Failed to summarise code" });
  }
});

// POST /api/summarize/conversation/:id
// Returns: { summary: string }
summarizeRouter.post("/summarize/conversation/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [conv] = await db
    .select()
    .from(tutorConversationsTable)
    .where(and(eq(tutorConversationsTable.id, id), eq(tutorConversationsTable.userId, userId)));

  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const messages = await db
    .select()
    .from(tutorMessagesTable)
    .where(eq(tutorMessagesTable.conversationId, id))
    .orderBy(tutorMessagesTable.createdAt)
    .limit(40);

  if (messages.length === 0) {
    res.json({ summary: "This chat has no messages yet." });
    return;
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Student" : "Coach"}: ${m.content.slice(0, 400)}`)
    .join("\n");

  const systemPrompt = `You are summarising a coaching conversation between a student (child aged 8–16) and an AI design coach helping them build a robot with a Raspberry Pi Pico W.
Write a 2–3 sentence summary a child or parent can read at a glance.
Cover: (1) what the student is trying to build or solve, (2) the key ideas or decisions reached, (3) any next steps mentioned.
Be friendly and positive. Plain language only — no markdown, no bullet points, no headings. Just the summary text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: TUTOR_MODEL,
      max_completion_tokens: 180,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Chat title: ${conv.title}\n\nTranscript:\n${transcript}` },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? "No summary available.";
    res.json({ summary });
  } catch {
    res.status(500).json({ error: "Failed to summarise conversation" });
  }
});
