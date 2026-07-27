/*
ICE AGE v1.1.0
Node for Max shortcut helper by Aynix.x.

The helper performs one task only:
1. Bring Ableton Live to the foreground.
2. Send Live 12's official Freeze / Unfreeze Tracks shortcut.

It never moves the mouse and accepts only one shortcut request at a time.
*/

const maxApi = require("max-api");
const { execFile } = require("child_process");

const VERSION = "1.1.0";
const PLATFORM = process.platform;
const EXEC_TIMEOUT_MS = 20000;

let activeChild = null;
let activeJobId = null;
let busy = false;
let operationToken = 0;

function runCommand(file, args, token) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      file,
      args,
      {
        windowsHide: true,
        timeout: EXEC_TIMEOUT_MS,
      },
      (error, stdout, stderr) => {
        if (token !== operationToken) {
          resolve("cancelled");
          return;
        }

        if (error) {
          const message = String(
            stderr || error.message || "unknown operating system error"
          ).trim();
          reject(new Error(message));
          return;
        }

        resolve(String(stdout || "").trim());
      }
    );

    activeChild = child;
  });
}

function runPowerShell(command, token) {
  return runCommand(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      command,
    ],
    token
  );
}

function runAppleScript(script, token) {
  return runCommand("osascript", ["-e", script], token);
}

async function sendFreezeShortcut(token) {
  if (PLATFORM === "win32") {
    await sendFreezeShortcutWindows(token);
    return;
  }

  if (PLATFORM === "darwin") {
    await sendFreezeShortcutMac(token);
    return;
  }

  throw new Error(
    "Unsupported operating system: " +
      PLATFORM +
      ". ICE AGE supports Windows and macOS."
  );
}

async function sendFreezeShortcutWindows(token) {
  const command = `
$ErrorActionPreference = "Stop"

$wshell = New-Object -ComObject WScript.Shell

$liveProcesses = @(
    Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and (
            $_.MainWindowTitle -match "Ableton Live" -or
            $_.ProcessName -match "^Ableton Live" -or
            $_.ProcessName -match "^Live($| )"
        )
    } | Sort-Object StartTime -Descending
)

if ($liveProcesses.Count -eq 0) {
    throw "Ableton Live window not found"
}

$liveProcess = $liveProcesses[0]
$activated = $wshell.AppActivate($liveProcess.Id)

if (-not $activated) {
    throw "Unable to bring Ableton Live to the foreground"
}

Start-Sleep -Milliseconds 250

# Live 12: Freeze / Unfreeze Tracks
# Ctrl + Alt + Shift + F
$wshell.SendKeys("^+%f")

Start-Sleep -Milliseconds 120
Write-Output "ICE_AGE_SHORTCUT_OK"
`;

  await runPowerShell(command, token);
}

async function sendFreezeShortcutMac(token) {
  const script = `
tell application "System Events"
    set liveProcesses to {}

    repeat with candidateProcess in application processes
        set processName to name of candidateProcess

        if processName starts with "Ableton Live" then
            set end of liveProcesses to candidateProcess
        end if
    end repeat

    if (count of liveProcesses) is 0 then
        error "Ableton Live process not found"
    end if

    set liveProcess to item 1 of liveProcesses

    repeat with candidateProcess in liveProcesses
        if frontmost of candidateProcess is true then
            set liveProcess to candidateProcess
            exit repeat
        end if
    end repeat

    set frontmost of liveProcess to true
    delay 0.25

    try
        perform action "AXRaise" of window 1 of liveProcess
    end try

    delay 0.15

    -- Live 12: Freeze / Unfreeze Tracks
    -- Cmd + Option + Shift + F
    keystroke "f" using {command down, option down, shift down}

    delay 0.12
end tell

return "ICE_AGE_SHORTCUT_OK"
`;

  await runAppleScript(script, token);
}

function cancelActiveOperation() {
  operationToken++;

  if (activeChild) {
    try {
      activeChild.kill();
    } catch (error) {}
  }

  activeChild = null;
  activeJobId = null;
  busy = false;
}

maxApi.addHandler("shortcut", async (jobId) => {
  const requestedJobId = String(jobId);

  if (busy) {
    maxApi.outlet(
      "shortcut_failed",
      requestedJobId,
      "shortcut helper is already busy"
    );
    return;
  }

  busy = true;
  activeJobId = requestedJobId;
  const token = ++operationToken;

  try {
    maxApi.post(
      "[ICE AGE Helper] Sending shortcut for job " + requestedJobId + "..."
    );

    await sendFreezeShortcut(token);

    if (token !== operationToken) return;
    maxApi.outlet("shortcut_done", requestedJobId);
  } catch (error) {
    if (token !== operationToken) return;

    const message =
      error && error.message ? error.message : "unknown shortcut helper error";

    maxApi.post("[ICE AGE Helper] " + message);
    maxApi.outlet("shortcut_failed", requestedJobId, message);
  } finally {
    if (token === operationToken) {
      activeChild = null;
      activeJobId = null;
      busy = false;
    }
  }
});

maxApi.addHandler("cancel", () => {
  const cancelledJobId = activeJobId;
  cancelActiveOperation();

  if (cancelledJobId !== null) {
    maxApi.post("[ICE AGE Helper] Cancelled job " + cancelledJobId + ".");
  }
});

maxApi.addHandler("ping", () => {
  maxApi.outlet("node_ready", PLATFORM);
});

process.on("exit", () => {
  cancelActiveOperation();
});

maxApi.outlet("node_ready", PLATFORM);
maxApi.post(
  "[ICE AGE Helper] v" + VERSION + " ready. Platform: " + PLATFORM + "."
);
