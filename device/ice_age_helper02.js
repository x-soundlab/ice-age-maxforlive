/*
Ice Age M4L v1.0.2 
Node for Max shortcut helper by Aynix.x.

Receives from Max:
- shortcut <jobId>
- ping

Windows:
- If Ableton Live is already focused, it does NOT move the mouse.
- If another window is focused, it brings Ableton Live forward and clicks only the title/top area.
- Sends Ctrl + Alt + Shift + F.

macOS:
- Focuses Ableton Live using System Events only when needed.
- Sends Cmd + Option + Shift + F.
- Requires macOS Accessibility/Automation permission for System Events / osascript.
*/

const maxApi = require("max-api");
const { execFile } = require("child_process");

const PLATFORM = process.platform;
const EXEC_TIMEOUT_MS = 10000;

function execFilePromise(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        windowsHide: true,
        timeout: EXEC_TIMEOUT_MS,
        ...options,
      },
      (error, stdout, stderr) => {
        if (error) {
          const message = (stderr || error.message || "unknown error").trim();
          reject(new Error(message));
          return;
        }
        resolve((stdout || "").trim());
      }
    );
  });
}

function runPowerShell(command) {
  return execFilePromise("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    command,
  ]);
}

function runAppleScript(script) {
  return execFilePromise("osascript", ["-e", script]);
}

async function sendFreezeShortcut() {
  if (PLATFORM === "win32") {
    await sendFreezeShortcutWindows();
    return;
  }

  if (PLATFORM === "darwin") {
    await sendFreezeShortcutMac();
    return;
  }

  throw new Error("Unsupported OS: " + PLATFORM + ". Ice Age supports Windows and macOS only.");
}

async function sendFreezeShortcutWindows() {
  const ps = `
$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}

public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

public struct POINT {
    public int X;
    public int Y;
}
"@

$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004

$wshell = New-Object -ComObject WScript.Shell

$liveProcesses = Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and (
        $_.MainWindowTitle -match "Ableton Live" -or
        $_.ProcessName -match "^Ableton" -or
        $_.ProcessName -match "^Live"
    )
} | Sort-Object StartTime -Descending

if (-not $liveProcesses -or $liveProcesses.Count -eq 0) {
    throw "Ableton Live window not found"
}

$p = @($liveProcesses)[0]
$hWnd = $p.MainWindowHandle

$foreground = [Win32]::GetForegroundWindow()
[uint32]$foregroundPid = 0
[void][Win32]::GetWindowThreadProcessId($foreground, [ref]$foregroundPid)

$alreadyFocused = ([int]$foregroundPid -eq [int]$p.Id)

if ($alreadyFocused) {
    # Ableton is already the foreground process. Do not move or click the mouse.
    Start-Sleep -Milliseconds 80
    $wshell.SendKeys("^+%f")
    Start-Sleep -Milliseconds 120
    Write-Output "ICE_AGE_V171_SHORTCUT_ALREADY_FOCUSED_OK"
    return
}

# Ableton is not focused: restore the old strong focus behavior.
$oldPoint = New-Object POINT
[void][Win32]::GetCursorPos([ref]$oldPoint)

[void][Win32]::ShowWindowAsync($hWnd, 9)
Start-Sleep -Milliseconds 120

[void][Win32]::SetForegroundWindow($hWnd)
Start-Sleep -Milliseconds 120

[void]$wshell.AppActivate($p.Id)
Start-Sleep -Milliseconds 120

$rect = New-Object RECT
[void][Win32]::GetWindowRect($hWnd, [ref]$rect)

# Strong focus click on title/top area only.
$clickX = [int](($rect.Left + $rect.Right) / 2)
$clickY = [int]($rect.Top + 12)

[void][Win32]::SetCursorPos($clickX, $clickY)
Start-Sleep -Milliseconds 60

[Win32]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 40
[Win32]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 160

[void][Win32]::SetCursorPos($oldPoint.X, $oldPoint.Y)
Start-Sleep -Milliseconds 80

# Ableton Freeze / Unfreeze Tracks shortcut on Windows:
# Ctrl + Alt + Shift + F
$wshell.SendKeys("^+%f")

Start-Sleep -Milliseconds 120

Write-Output "ICE_AGE_V171_SHORTCUT_REFOCUSED_OK"
`;

  await runPowerShell(ps);
}

async function sendFreezeShortcutMac() {
  const script = `
tell application "System Events"
    set liveProcesses to {}

    repeat with p in application processes
        set processName to name of p
        if processName contains "Ableton Live" or processName contains "Live" then
            set end of liveProcesses to p
        end if
    end repeat

    if (count of liveProcesses) is 0 then
        error "Ableton Live process not found"
    end if

    set liveProcess to item 1 of liveProcesses

    if frontmost of liveProcess is false then
        set frontmost of liveProcess to true
        delay 0.25
        try
            perform action "AXRaise" of window 1 of liveProcess
        end try
        delay 0.2
    else
        delay 0.08
    end if

    -- Ableton Freeze / Unfreeze Tracks shortcut on macOS:
    -- Cmd + Option + Shift + F
    keystroke "f" using {command down, option down, shift down}

    delay 0.12
end tell

return "ICE_AGE_V171_MAC_SHORTCUT_OK"
`;

  await runAppleScript(script);
}

maxApi.addHandler("shortcut", async (jobId) => {
  try {
    maxApi.post("[Ice Age Shortcut] v1.0.2 shortcut for job " + jobId + "...");
    await sendFreezeShortcut();
    maxApi.outlet("shortcut_done", String(jobId));
  } catch (err) {
    const message = err && err.message ? err.message : "unknown";
    maxApi.post("[Ice Age Shortcut] Error: " + message);
    maxApi.outlet("shortcut_failed", String(jobId), message);
  }
});

maxApi.addHandler("ping", () => {
  maxApi.outlet("node_ready", PLATFORM);
});

maxApi.post("[Ice Age Shortcut] Group Unfold helper v1.0.2 loaded. Platform: " + PLATFORM);
