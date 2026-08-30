import { useUser } from "@clerk/react";
import { useListSensorReadings, useListConnectedModules, useListProjects, useListTutorConversations } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Cpu,
  AlertCircle,
  Bluetooth,
  BluetoothOff,
  BluetoothSearching,
  X,
  Code2,
  MessageSquare,
  FolderGit2,
  Camera,
  ArrowRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";

type BtStatus = "idle" | "scanning" | "connected" | "disconnected" | "unsupported";

interface LiveReading {
  sensorName: string;
  moduleType: string;
  value: number;
  unit: string;
  timestamp: string;
}

function useBluetooth() {
  // Always optimistic — we discover support at connection time so the button
  // is never hidden just because of the secure-context / iframe restrictions.
  const [btStatus, setBtStatus] = useState<BtStatus>("idle");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [liveReadings, setLiveReadings] = useState<LiveReading[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const charRef = useRef<any>(null);

  const connectWebSocket = useCallback(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "ping" }));
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as { type: string; reading?: LiveReading };
        if (msg.type === "sensor_update" && msg.reading) {
          setLiveReadings((prev) => {
            const filtered = prev.filter((r) => r.sensorName !== msg.reading!.sensorName);
            return [msg.reading!, ...filtered].slice(0, 12);
          });
        }
      } catch { /* ignore */ }
    };
    ws.onclose = () => { wsRef.current = null; };
    return ws;
  }, []);

  const handleCharacteristicChange = useCallback(
    (ws: WebSocket) => (evt: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = (evt.target as any) as { value: DataView };
      const raw = new TextDecoder().decode(target.value!);
      try {
        const payload = JSON.parse(raw) as { type: string; moduleType: string; sensorName: string; value: number; unit: string; };
        if (payload.type === "sensor_reading" && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ...payload, type: "sensor_reading" }));
        }
      } catch {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "sensor_reading", moduleType: "unknown", sensorName: "BT Raw", value: parseFloat(raw) || 0, unit: "raw" }));
        }
      }
    },
    []
  );

  const [btError, setBtError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setBtError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bt = (navigator as any).bluetooth as unknown;
    if (!bt) {
      setBtError(
        "Web Bluetooth isn't available here. Open the app in Chrome (desktop) in a regular tab — not an embedded preview."
      );
      setBtStatus("disconnected");
      return;
    }

    setBtStatus("scanning");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["6e400001-b5a3-f393-e0a9-e50e24dcca9e"],
      });
      deviceRef.current = device;
      setDeviceName(device.name ?? "EcoBot Pico W");
      const server = await device.gatt!.connect();
      setBtStatus("connected");
      const ws = connectWebSocket();
      try {
        const service = await server.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
        const char = await service.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
        charRef.current = char;
        await char.startNotifications();
        char.addEventListener("characteristicvaluechanged", handleCharacteristicChange(ws));
      } catch { /* service not yet available on device */ }
      device.addEventListener("gattserverdisconnected", () => {
        setBtStatus("disconnected");
        setDeviceName(null);
        ws.close();
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === "NotFoundError") {
          setBtStatus("idle"); // user cancelled picker
        } else if (err.name === "SecurityError") {
          setBtError("Bluetooth access was blocked. Open the app directly in Chrome (not an iframe).");
          setBtStatus("disconnected");
        } else {
          setBtStatus("disconnected");
        }
      } else {
        setBtStatus("disconnected");
      }
    }
  }, [connectWebSocket, handleCharacteristicChange]);

  const disconnect = useCallback(() => {
    charRef.current?.stopNotifications().catch(() => {});
    deviceRef.current?.gatt?.disconnect();
    wsRef.current?.close();
    setBtStatus("idle");
    setDeviceName(null);
  }, []);

  useEffect(() => { return () => { wsRef.current?.close(); }; }, []);

  return { btStatus, deviceName, liveReadings, btError, connect, disconnect };
}

function ProfileHeader() {
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "Engineer";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      await user.setProfileImage({ file });
    } catch { /* ignore */ } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-5">
      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt="Profile"
            className="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary/20 transition-opacity group-hover:opacity-80"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl ring-2 ring-primary/20 transition-opacity group-hover:opacity-80">
            {displayName[0]?.toUpperCase() ?? "U"}
          </div>
        )}
        <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="w-4 h-4 text-white" />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary mb-0.5">Welcome back</p>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{displayName}</h1>
        <p className="text-sm text-muted-foreground">{user?.emailAddresses?.[0]?.emailAddress}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: readingsRaw } = useListSensorReadings();
  // Harden against the API returning null/undefined or a non-array shape
  // (e.g. a fresh account with no data), which would crash .slice()/.map().
  const readings = Array.isArray(readingsRaw) ? readingsRaw : [];
  const { data: modulesRaw } = useListConnectedModules();
  const modules = Array.isArray(modulesRaw) ? modulesRaw : [];
  const { data: projectsRaw, isLoading: projectsLoading } = useListProjects();
  const projects = Array.isArray(projectsRaw) ? projectsRaw : [];
  const { data: conversationsRaw, isLoading: convsLoading } = useListTutorConversations();
  const conversations = Array.isArray(conversationsRaw) ? conversationsRaw : [];
  const { btStatus, deviceName, liveReadings, btError, connect, disconnect } = useBluetooth();

  const lastProject = projects?.[0];
  const lastConversation = conversations?.[0];
  const isConnected = btStatus === "connected";

  const BtIcon = btStatus === "connected" ? Bluetooth : btStatus === "scanning" ? BluetoothSearching : BluetoothOff;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero banner with background */}
      <div className="relative rounded-2xl overflow-hidden border bg-card shadow-sm">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />
        {/* Circuit dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Diagonal accent line */}
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary/30 to-transparent pointer-events-none" style={{ right: "33%" }} />

        {/* Content */}
        <div className="relative flex items-center justify-between flex-wrap gap-4 p-6">
          <ProfileHeader />

          {/* BT connect — always visible */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-3">
              {isConnected && deviceName && (
                <span className="text-sm text-muted-foreground font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                  {deviceName}
                </span>
              )}
              {isConnected ? (
                <Button size="sm" variant="outline" onClick={disconnect} className="gap-1.5 h-8 bg-background/80 backdrop-blur-sm">
                  <X className="w-3.5 h-3.5" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={connect}
                  disabled={btStatus === "scanning"}
                  className="gap-1.5 h-8"
                  variant={btStatus === "disconnected" ? "outline" : "default"}
                >
                  <BtIcon className="w-3.5 h-3.5" />
                  {btStatus === "scanning" ? "Scanning..." : btStatus === "disconnected" ? "Retry connect" : "Connect Pico W"}
                </Button>
              )}
            </div>
            {btError && (
              <p className="text-[11px] text-amber-600 max-w-[280px] text-right leading-snug">{btError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Sketches</CardTitle>
            <Code2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {projectsLoading ? <Skeleton className="h-8 w-12" /> : (
              <div className="text-2xl font-bold">{projects?.length ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">MicroPython projects</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">AI Sessions</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {convsLoading ? <Skeleton className="h-8 w-12" /> : (
              <div className="text-2xl font-bold">{conversations?.length ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Design conversations</p>
          </CardContent>
        </Card>

        <Card className={`hover-elevate ${isConnected ? "border-blue-500/30 bg-blue-500/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={`text-sm font-medium ${isConnected ? "text-blue-600" : ""}`}>
              Pico W Status
            </CardTitle>
            <BtIcon className={`w-4 h-4 ${isConnected ? "text-blue-600 animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isConnected ? "text-blue-600" : "text-muted-foreground"}`}>
              {isConnected ? "Live" : btStatus === "scanning" ? "Scanning" : "Offline"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isConnected ? `Connected via BLE · ${liveReadings.length} readings` : "Not connected — use the button above"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="hover-elevate group cursor-pointer" onClick={() => setLocation("/editor")}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Code2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {lastProject ? "Open recent sketch" : "Get started"}
                  </p>
                  <p className="font-semibold leading-tight">
                    {lastProject ? lastProject.name : "Create your first sketch"}
                  </p>
                  {lastProject && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {new Date(lastProject.updatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate group cursor-pointer" onClick={() => setLocation("/tutor")}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {lastConversation ? "Resume last chat" : "Get started"}
                  </p>
                  <p className="font-semibold leading-tight">
                    {lastConversation ? lastConversation.title : "Ask the AI Design Coach"}
                  </p>
                  {lastConversation && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Stage: {lastConversation.workflowStage ?? "idea"}
                    </p>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pico W live feed */}
      <Card className={isConnected ? "border-blue-500/30 bg-blue-500/5" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bluetooth className={`w-4 h-4 ${isConnected ? "text-blue-600 animate-pulse" : "text-muted-foreground"}`} />
            <CardTitle className={isConnected ? "text-blue-700" : ""}>Pico W Live Data</CardTitle>
          </div>
          <CardDescription>
            {isConnected
              ? `Streaming from ${deviceName ?? "your device"} via Bluetooth`
              : "Connect your Pico W via Bluetooth to see live sensor readings"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <BluetoothOff className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Pico W is not connected</p>
              <p className="text-xs text-muted-foreground/70 max-w-xs">
                Press "Connect Pico W" above, then select your device from the browser Bluetooth picker.
              </p>
              <Button size="sm" className="mt-2 gap-2" onClick={connect} disabled={btStatus === "scanning"}>
                <Bluetooth className="w-3.5 h-3.5" />
                {btStatus === "scanning" ? "Scanning..." : "Connect now"}
              </Button>
              {btError && (
                <p className="text-[11px] text-amber-600 max-w-xs leading-snug">{btError}</p>
              )}
            </div>
          ) : liveReadings.length === 0 ? (
            <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
              <BluetoothSearching className="w-5 h-5 animate-pulse text-blue-500" />
              Waiting for sensor data from your Pico W... Make sure your MicroPython script is running.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {liveReadings.map((r, i) => (
                <div key={i} className="rounded-xl border border-blue-500/20 bg-background p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{r.moduleType}</p>
                  <p className="text-sm font-semibold">{r.sensorName}</p>
                  <p className="text-xl font-mono font-bold text-blue-600">
                    {typeof r.value === "number" ? r.value.toFixed(1) : r.value}
                    <span className="text-xs font-normal text-muted-foreground ml-1">{r.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom row: Sensor history + Modules (only meaningful when connected) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Sensor History</CardTitle>
            </div>
            <CardDescription>
              {readings && readings.length > 0
                ? "Recent readings saved from previous sessions"
                : "No historical data yet — readings will appear here after a BLE session"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {readings && readings.length > 0 ? (
              <div className="space-y-3">
                {readings.slice(0, 5).map((reading) => (
                  <div
                    key={reading.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate transition-colors"
                    data-testid={`card-reading-${reading.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm font-medium leading-none">{reading.sensorName}</p>
                        <p className="text-xs text-muted-foreground mt-1">{reading.moduleType}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-mono font-bold text-primary">
                        {reading.value.toFixed(1)} {reading.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(reading.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="empty-readings">
                <AlertCircle className="w-7 h-7 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No readings stored yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Detected Modules</CardTitle>
            </div>
            <CardDescription>
              {modules && modules.length > 0
                ? "PCB modules detected on your EcoBot"
                : isConnected ? "No modules detected — check your connections" : "Connect Pico W to detect attached modules"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {modules && modules.length > 0 ? (
              <div className="grid gap-3">
                {modules.map((mod) => (
                  <div
                    key={mod.id}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-card hover-elevate transition-colors"
                    data-testid={`card-module-${mod.id}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                      <Cpu className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold">{mod.displayName}</h4>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">Pins: {mod.pinConfig}</p>
                    </div>
                    <Badge variant={mod.isConnected ? "default" : "secondary"}>
                      {mod.isConnected ? "Live" : "Offline"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="empty-modules">
                <FolderGit2 className="w-7 h-7 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {isConnected ? "No modules detected on the board" : "Connect a Pico W to detect modules"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
