import { useState } from "react";
import { useGetProject, useUpdateProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Save, Bot, ChevronRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const WORKFLOW_STAGES = [
  { id: "idea",      label: "Idea",      color: "sky" },
  { id: "hardware",  label: "Hardware",  color: "violet" },
  { id: "software",  label: "Software",  color: "indigo" },
  { id: "chassis",   label: "Chassis",   color: "amber" },
  { id: "prototype", label: "Prototype", color: "orange" },
  { id: "debug",     label: "Debug",     color: "rose" },
  { id: "product",   label: "Product",   color: "emerald" },
] as const;

export default function ProjectDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { data: project, isLoading } = useGetProject(id, { query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) } });
  const updateProject = useUpdateProject();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [code, setCode] = useState<string | undefined>();
  const [isRunning, setIsRunning] = useState(false);

  // Sync initial code
  if (project && code === undefined) {
    setCode(project.code);
  }

  const handleSave = () => {
    if (!code) return;
    updateProject.mutate({
      id,
      data: { code }
    }, {
      onSuccess: () => {
        toast({ title: "Code saved successfully", variant: "default" });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
      }
    });
  };

  const handleStageChange = (stage: any) => {
    updateProject.mutate({
      id,
      data: { workflowStage: stage }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
      }
    });
  };

  if (isLoading || !project) {
    return (
      <div className="h-full flex flex-col space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Skeleton className="lg:col-span-3 h-full" />
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between shrink-0 bg-card border rounded-lg p-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold leading-none">{project.name}</h1>
            <Badge variant="outline" className="font-mono text-[10px]">
              {project.language}
            </Badge>
          </div>
          <Tabs 
            value={project.workflowStage} 
            onValueChange={handleStageChange}
            className="w-full mt-2"
          >
            <TabsList className="h-8">
              {WORKFLOW_STAGES.map(stage => (
                <TabsTrigger key={stage.id} value={stage.id} className="text-xs px-3">
                  {stage.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={updateProject.isPending} data-testid="button-save-project">
            {updateProject.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
          <Button 
            onClick={() => { setIsRunning(true); setTimeout(() => setIsRunning(false), 1500); }} 
            disabled={isRunning}
            data-testid="button-run-project"
          >
            {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Run on Device
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-4 min-h-0">
        <Card className="xl:col-span-3 flex flex-col overflow-hidden border-2 shadow-sm">
          <div className="bg-muted px-4 py-2 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">main.py</span>
            </div>
            {project.code !== code && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Unsaved changes</span>
            )}
          </div>
          <div className="flex-1 min-h-[400px]">
            <Editor
              height="100%"
              defaultLanguage={project.language === "micropython" ? "python" : project.language}
              theme="vs-dark"
              value={code || ""}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "var(--app-font-mono)",
                lineHeight: 1.6,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: "smooth",
                renderLineHighlight: "all"
              }}
            />
          </div>
        </Card>

        {/* Simplified Sidebar for AI Tutor CTA */}
        <Card className="flex flex-col overflow-hidden bg-sidebar shadow-sm">
          <div className="p-4 border-b bg-primary/10 flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-primary">Lab Assistant</h3>
          </div>
          <CardContent className="p-4 flex-1 flex flex-col justify-center items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Bot className="w-8 h-8 text-secondary-foreground" />
            </div>
            <div>
              <h4 className="font-bold mb-1">Stuck on your code?</h4>
              <p className="text-sm text-muted-foreground">
                The AI Tutor can help you debug, brainstorm, or understand the <strong>{project.workflowStage}</strong> phase.
              </p>
            </div>
            <Button className="w-full mt-4 group" asChild data-testid="link-tutor">
              <Link href="/tutor">
                Open Full Tutor
                <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
