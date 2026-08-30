import { Router } from "express";
import type { Request } from "express";
import { getAuth } from "@clerk/express";
import { openai, TUTOR_MODEL } from "@workspace/integrations-openai-ai-server";

export const debugRouter = Router();

interface DebugIssue {
  line: number | null;
  type: "error" | "warning" | "tip";
  message: string;
  fix: string | null;
}

interface DebugResult {
  issues: DebugIssue[];
  summary: string;
}

// POST /api/debug/analyze
debugRouter.post("/debug/analyze", async (req: Request, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const systemPrompt = `You are a MicroPython code reviewer for kids aged 8–16 building robots with a Raspberry Pi Pico W using EcoBotOS.

Analyse the provided MicroPython code. Your entire response must be one valid JSON object and nothing else — no markdown, no code fences, no explanation before or after the JSON.

Required shape:
{"issues":[{"line":<integer or null>,"type":"error"|"warning"|"tip","message":"<short kid-friendly description>","fix":"<1-3 lines of corrected code or null>"}],"summary":"<1-2 sentences>"}

## EcoBotOS API (pre-installed on every Pico W)
  from ecobot_os import EcoBotOS   ← always required at top
  bot = EcoBotOS()                  ← always required before using bot.*
  bot.m1.spin(speed)  # speed -100 to 100 (-=backward, +=forward, 0=stop)
  bot.m2.spin(speed)  # same for m2, m3, m4
  bot.s1.read()       # int = distance mm (ultrasonic, only s1 is active)
  bot.s1.read(bool)   # True if <200mm
  bot.s1.read(str)    # "Xmm"
  # bot.s2 to bot.s8 are None — do not use yet

## Rules for analysis
- "error": code that will crash or not run — syntax errors, wrong imports (e.g. importing machine/Pin directly instead of using EcoBotOS), missing "bot = EcoBotOS()", calling bot.s2–bot.s8 (they are None and will crash), undefined variables
- "warning": code that runs but behaves unexpectedly — blocking while-True with no time.sleep, spin speed outside -100/100, polling too fast, calling bot.s1.read() without checking for None return
- "tip": style suggestions — magic numbers, missing comments, functions that are too long
- Do NOT flag "from ecobot_os import EcoBotOS" as an error — it is the correct and required import
- Do NOT suggest using "from machine import Pin" or similar — EcoBotOS handles hardware internally
- If there are no issues return an empty issues array
- Keep messages simple — the reader is a child learning to code
- summary should be 1-2 honest sentences; do not be falsely positive if there are real errors`;

  try {
    const completion = await openai.chat.completions.create({
      model: TUTOR_MODEL,
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyse this MicroPython code:\n\`\`\`python\n${code}\n\`\`\`` },
      ],
    });

    const raw = (completion.choices[0]?.message?.content ?? "").trim();
    req.log.info({ rawLength: raw.length, rawPreview: raw.slice(0, 200) }, "debug: raw AI response");

    // strip markdown fences if model adds them despite instructions
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ raw }, "debug: no JSON object found in AI response");
      res.status(502).json({ error: "AI returned unparseable response", raw: raw.slice(0, 300) });
      return;
    }
    const result = JSON.parse(jsonMatch[0]) as DebugResult;
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "debug: AI call failed");
    res.status(502).json({ error: "AI analysis failed", detail: err instanceof Error ? err.message : String(err) });
  }
});
