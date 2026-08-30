import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Bot, Send, User, Plus, MessageSquare, Loader2, Pencil, Trash2, Check, X,
  ArrowRight, Undo2, Sparkles, PanelLeft,
} from "lucide-react";
import { useListTutorConversations, useCreateTutorConversation, CreateTutorConversationBodyWorkflowStage } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STAGES = [
  { key: "idea",      label: "Idea",       color: "text-sky-600",     ring: "border-sky-500",     bg: "bg-sky-500" },
  { key: "hardware",  label: "Hardware",   color: "text-violet-600",  ring: "border-violet-500",  bg: "bg-violet-500" },
  { key: "software",  label: "Software",   color: "text-indigo-600",  ring: "border-indigo-500",  bg: "bg-indigo-500" },
  { key: "chassis",   label: "Chassis",    color: "text-amber-600",   ring: "border-amber-500",   bg: "bg-amber-500" },
  { key: "prototype", label: "Prototype",  color: "text-orange-600",  ring: "border-orange-500",  bg: "bg-orange-500" },
  { key: "debug",     label: "Debug",      color: "text-rose-600",    ring: "border-rose-500",    bg: "bg-rose-500" },
  { key: "product",   label: "Product",    color: "text-emerald-600", ring: "border-emerald-500", bg: "bg-emerald-500" },
] as const;

const STAGE_COLORS: Record<string, string> = {
  idea:      "bg-sky-500/10 text-sky-600 border-sky-500/20",
  hardware:  "bg-violet-500/10 text-violet-600 border-violet-500/20",
  software:  "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  chassis:   "bg-amber-500/10 text-amber-600 border-amber-500/20",
  prototype: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  debug:     "bg-rose-500/10 text-rose-600 border-rose-500/20",
  product:   "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  idea:      "What's the idea? Is it possible? What's the user's end goal?",
  hardware:  "What parts do we need? Do they exist? Cost & alternatives?",
  software:  "What commands & code structure does this project need?",
  chassis:   "Is the chassis durable enough? Can it fit & carry everything?",
  prototype: "How do we wire & arrange it? Step-by-step build plan.",
  debug:     "Testing & refining. Isolate problems. Improve what works.",
  product:   "Make it better. New additions. User experience.",
};

function WorkflowProgress({
  stage,
  onStageClick,
  conversationId,
}: {
  stage: string;
  onStageClick: (key: string) => void;
  conversationId: number | null;
}) {
  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-0.5 flex-wrap">
        {STAGES.map((s, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <div key={s.key} className="flex items-center gap-0.5">
              <button
                onClick={() => conversationId && onStageClick(s.key)}
                disabled={!conversationId}
                title={STAGE_DESCRIPTIONS[s.key] ?? s.label}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all
                  ${isCurrent
                    ? `${s.bg} text-white border-transparent shadow-sm`
                    : isCompleted
                      ? `bg-muted border-border text-muted-foreground`
                      : `bg-background border-border text-muted-foreground/60 hover:border-muted-foreground/40`
                  }
                  ${conversationId ? "cursor-pointer" : "cursor-default"}
                `}
              >
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0
                  ${isCurrent ? "bg-white/30" : isCompleted ? "bg-muted-foreground/20" : "bg-muted"}
                `}>
                  {isCompleted ? "✓" : idx + 1}
                </span>
                {s.label}
              </button>
              {idx < STAGES.length - 1 && (
                <div className={`w-2.5 h-px ${isCompleted ? "bg-primary/40" : "bg-border"} shrink-0`} />
              )}
            </div>
          );
        })}
      </div>
      {/* Current stage description */}
      {(() => {
        const cur = STAGES[currentIdx];
        return cur ? (
          <p className="text-[10px] text-muted-foreground/70 leading-snug pl-0.5">
            <span className="font-medium">{cur.label}:</span> {STAGE_DESCRIPTIONS[cur.key]}
          </p>
        ) : null;
      })()}
    </div>
  );
}

export default function Tutor() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hey, I'm Sprocket — your EcoBot design coach. We'll work through seven engineering stages together — Idea, Hardware, Software, Chassis, Prototype, Debug, and Product. Each step matters; skipping them is how projects break.\n\nLet's start at the beginning. What do you want to build — and be specific. 'A robot that does stuff' tells me nothing.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [stage, setStage] = useState("idea");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [stageHint, setStageHint] = useState<{ action: string; targetStage: string; reason: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [convSheetOpen, setConvSheetOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamedContentRef = useRef("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { data: conversationsRaw, refetch: refetchConversations } = useListTutorConversations();
  const conversations = Array.isArray(conversationsRaw) ? conversationsRaw : [];
  const { mutateAsync: createConversation } = useCreateTutorConversation();
  const autoLoadedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (!conversations || conversations.length === 0) return;
    autoLoadedRef.current = true;
    const mostRecent = conversations[0];
    if (mostRecent) loadConversation(mostRecent.id).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const getOrCreateConversation = useCallback(async (): Promise<number> => {
    if (conversationId !== null) return conversationId;
    setIsCreatingConversation(true);
    try {
      const conv = await createConversation({
        data: { title: `Session — ${new Date().toLocaleDateString()}`, workflowStage: stage as CreateTutorConversationBodyWorkflowStage },
      });
      setConversationId(conv.id);
      refetchConversations();
      return conv.id;
    } finally {
      setIsCreatingConversation(false);
    }
  }, [conversationId, stage, createConversation, refetchConversations]);

  const updateStage = useCallback(async (newStage: string, convId: number | null) => {
    setStage(newStage);
    if (convId === null) return;
    try {
      await fetch(`/api/tutor/conversations/${convId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowStage: newStage }),
      });
      refetchConversations();
    } catch {
      // non-critical
    }
  }, [refetchConversations]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsStreaming(true);
    streamedContentRef.current = "";
    setStageHint(null);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const convId = await getOrCreateConversation();
      abortRef.current = new AbortController();
      const res = await fetch(`/api/tutor/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, workflowStage: stage }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let textDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as {
              content?: string;
              done?: boolean;
              stageHint?: { action: string; targetStage: string; reason: string };
            };
            if (parsed.done) {
              textDone = true;
              // keep reading — stage hint may follow
            } else if (parsed.stageHint && textDone) {
              setStageHint(parsed.stageHint);
            } else if (parsed.content && !textDone) {
              streamedContentRef.current += parsed.content;
              const snapshot = streamedContentRef.current;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: snapshot };
                return updated;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Something went wrong. Check the server and try again.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const startNewConversation = () => {
    if (isStreaming) abortRef.current?.abort();
    setConversationId(null);
    setStage("idea");
    setStageHint(null);
    setMessages([{ role: "assistant", content: "New project — let's start at the beginning. What do you want to build? Be specific." }]);
    setInput("");
  };

  const loadConversation = async (convId: number) => {
    if (isStreaming) return;
    try {
      const res = await fetch(`/api/tutor/conversations/${convId}`);
      const data = (await res.json()) as {
        id: number;
        workflowStage: string;
        messages: { role: string; content: string }[];
      };
      setConversationId(convId);
      setStage(data.workflowStage ?? "observe");
      setStageHint(null);
      const loaded: Message[] = (data.messages ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      setMessages(
        loaded.length
          ? loaded
          : [{ role: "assistant", content: "Conversation loaded. Where were we?" }]
      );
    } catch { /* ignore */ }
  };

  const startRename = (convId: number, currentTitle: string) => {
    setRenamingId(convId);
    setRenameValue(currentTitle);
  };

  const confirmRename = async () => {
    if (!renamingId) return;
    const newTitle = renameValue.trim() || "Untitled";
    try {
      await fetch(`/api/tutor/conversations/${renamingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      refetchConversations();
    } catch {
      toast({ title: "Failed to rename", variant: "destructive" });
    } finally {
      setRenamingId(null);
    }
  };

  const deleteConversation = async (convId: number) => {
    try {
      await fetch(`/api/tutor/conversations/${convId}`, { method: "DELETE" });
      if (conversationId === convId) startNewConversation();
      refetchConversations();
      toast({ title: "Conversation deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const ConversationList = ({ onSelect }: { onSelect?: () => void }) => (
    <>
      <Button onClick={() => { startNewConversation(); onSelect?.(); }} size="sm" className="w-full gap-2" variant="outline">
        <Plus className="w-4 h-4" />
        New Session
      </Button>
      <div className="flex-1 overflow-y-auto space-y-1">
        {conversations?.map((conv) => (
          <div key={conv.id} className="relative group">
            {renamingId === conv.id ? (
              <div className="flex items-center gap-1 px-2 py-1">
                <Input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename();
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="h-7 text-xs flex-1"
                />
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={confirmRename}>
                  <Check className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setRenamingId(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => { loadConversation(conv.id); onSelect?.(); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-muted pr-16 ${
                  conversationId === conv.id ? "bg-muted font-medium" : ""
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{conv.title}</span>
                </div>
                <div className="mt-0.5 ml-5">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${STAGE_COLORS[conv.workflowStage ?? "observe"]}`}>
                    {STAGES.find((s) => s.key === conv.workflowStage)?.label ?? "Observe"}
                  </span>
                </div>
              </button>
            )}

            {renamingId !== conv.id && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); startRename(conv.id, conv.title); }}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col md:flex-row gap-3 md:gap-4 animate-in fade-in duration-500" style={{ minHeight: 0 }}>
      {/* Mobile conversation Sheet */}
      <Sheet open={convSheetOpen} onOpenChange={setConvSheetOpen}>
        <SheetContent side="left" className="w-72 flex flex-col gap-3 pt-10">
          <SheetHeader>
            <SheetTitle>Sessions</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <ConversationList onSelect={() => setConvSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Conversation sidebar — desktop only */}
      <div className="hidden md:flex md:w-56 md:shrink-0 flex-col gap-3">
        <ConversationList />
      </div>

      {/* Main chat area */}
      <Card className="flex-1 flex flex-col overflow-hidden shadow-md border-2" style={{ minHeight: 0 }}>
        {/* Workflow progress bar */}
        <div className="px-3 md:px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
          {/* Mobile: sessions drawer button */}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden gap-1.5 h-7 text-xs shrink-0"
            onClick={() => setConvSheetOpen(true)}
          >
            <PanelLeft className="w-3 h-3" />
            Sessions
          </Button>
          <div className="flex-1 min-w-0">
            <WorkflowProgress
              stage={stage}
              onStageClick={(key) => updateStage(key, conversationId)}
              conversationId={conversationId}
            />
          </div>
          {conversationId && (
            <Badge variant="outline" className="text-xs shrink-0">
              #{conversationId}
            </Badge>
          )}
        </div>

        {/* AI Stage Hint Banner */}
        {stageHint && (
          <div className="px-4 py-2 border-b bg-amber-50/80 dark:bg-amber-950/30 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                {stageHint.action === "advance" ? (
                  <span className="flex items-center gap-1">
                    Ready to advance to <span className="capitalize font-bold">{stageHint.targetStage}</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Undo2 className="w-3 h-3" />
                    Revisit <span className="capitalize font-bold">{stageHint.targetStage}</span>
                  </span>
                )}
              </p>
              <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 truncate">{stageHint.reason}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] border-amber-400 text-amber-700 hover:bg-amber-100"
                onClick={() => {
                  updateStage(stageHint.targetStage, conversationId);
                  setStageHint(null);
                }}
              >
                <Check className="w-3 h-3 mr-1" />
                Apply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-muted-foreground"
                onClick={() => setStageHint(null)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-5 pb-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 ring-1 ring-primary/30"
                  }`}
                >
                  {msg.role === "user"
                    ? <User className="w-4 h-4" />
                    : <img src="/sprocket-face.png" alt="Sprocket" className="w-7 h-7 object-contain" style={{ imageRendering: "pixelated" }} />}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2.5 max-w-[82%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-muted text-foreground rounded-tl-none"
                  }`}
                >
                  {msg.content ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="flex items-center gap-1.5 py-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0.15s" }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0.3s" }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 bg-background border-t">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isCreatingConversation ? "Starting session..." : "Tell me about your robot idea..."}
              className="flex-1 bg-muted/50 border-transparent focus-visible:ring-primary"
              disabled={isStreaming || isCreatingConversation}
              data-testid="input-tutor-message"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isStreaming || isCreatingConversation}
              size="icon"
              data-testid="button-send-tutor"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
