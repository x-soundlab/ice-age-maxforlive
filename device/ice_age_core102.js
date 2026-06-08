/*
Ice Age M4L v1.0.2 GROUP UNFOLD FIX
Max JS file for Ice Age by Aynix.x.

Goal:
- Rebuilt clean core from the working flow.
- Auto-reset if the user clicks ICE AGE / FREEZE AUDIO / FREEZE MIDI while the device is still running.
- Temporarily unfold group tracks so child tracks inside closed groups can be selected/frozen.
- Skip group/foldable tracks explicitly before selection.
- Scan all tracks first.
- Build a closed queue before freezing.
- Filter out tracks that should not be frozen.
- Use the stable Node helper so changing windows can keep working.
- Start a freeze marker BEFORE sending the shortcut.
- Check is_frozen independently of shortcut_done.
- Auto-stop/reset when queue is complete.
- Auto-stop on cancel/timeout/interruption.

Important:
Ableton Freeze is triggered by keyboard shortcut. Live API does not expose a clean
per-track Freeze method, so the device selects a track then sends Ableton's Freeze shortcut.
*/

autowatch = 1;
inlets = 1;
outlets = 3; // 0 -> node.script, 1 -> debug print, 2 -> UI status text

var dryRun = 0;
var debugMode = 0;
var skipNameTag = 1;
var settleMs = 500;
var pollMs = 250;
var timeoutMs = 60000;

var hostTrackId = 0;
var hostTrackName = "";
var hostTrackIndex = -1;

var running = 0;
var stopping = 0;
var queue = [];
var current = null;
var currentMode = "all";
var jobCounter = 0;
var activeTasks = [];

var totalQueue = 0;
var processedCount = 0;
var initAttempts = 0;
var maxInitAttempts = 80;
var pendingMode = null;
var setupDone = 0;

// Group handling:
// Ableton's freeze shortcut acts on the visible/selected track.
// If a group is collapsed, child tracks can be hidden from the UI and the shortcut may not hit them.
// Ice Age temporarily unfolds foldable/group tracks before building the queue, then restores their fold state.
var groupUnfoldPasses = 3;
var groupUnfoldSettleMs = 200;
var restoreGroupFolds = 1;
var groupFoldStateCache = {};
var groupPrepActive = 0;

var report = emptyReport("");

function nowMs() {
    return (new Date()).getTime();
}

function cleanStatus(s) {
    s = String(s || "");
    s = s.replace(/[—–]/g, "-").replace(/[·•]/g, "/").replace(/[^\x20-\x7E]/g, "");
    if (s.length > 110) s = s.substring(0, 110);
    return s;
}

function keepTask(task) {
    activeTasks.push(task);
    task.schedule(task._iceAgeDelay || 0);
}

function schedule(fn, delayMsValue) {
    var task = new Task(function () {
        try {
            fn();
        } finally {
            for (var i = activeTasks.length - 1; i >= 0; i--) {
                if (activeTasks[i] === task) {
                    activeTasks.splice(i, 1);
                    break;
                }
            }
        }
    }, this);

    task._iceAgeDelay = delayMsValue;
    keepTask(task);
}

function cancelTasks() {
    for (var i = 0; i < activeTasks.length; i++) {
        try {
            if (activeTasks[i] && activeTasks[i].cancel) activeTasks[i].cancel();
        } catch (e) {}
    }
    activeTasks = [];
}

function emptyReport(mode) {
    return {
        mode: mode,
        found: 0,
        queued: 0,
        frozenBefore: 0,
        skipped: 0,
        failed: 0,
        done: 0,
        stopped: 0,
        items: []
    };
}

function log(msg) {
    post("[Ice Age] " + msg + "\n");
    outlet(1, msg);
}

function ui(msg) {
    outlet(2, "set", cleanStatus(msg));
}

function getLiveSet() {
    return new LiveAPI("live_set");
}

function getView() {
    return new LiveAPI("live_set view");
}

function liveSetReady() {
    try {
        var ls = getLiveSet();
        var c = ls.getcount("tracks");
        if (typeof c === "number" && c >= 0) return true;
        var n = parseInt(c, 10);
        return !isNaN(n) && n >= 0;
    } catch (e) {
        return false;
    }
}

function waitForLive() {
    initAttempts++;

    if (liveSetReady()) {
        detectHostTrack();
        log("Live API ready.");
        ui(hostTrackId ? "Ready" : "Ready - host track not detected");

        if (pendingMode !== null) {
            var mode = pendingMode;
            pendingMode = null;
            schedule(function () { startFreeze(mode); }, 100);
        }
        return;
    }

    if (initAttempts <= maxInitAttempts) {
        ui("Loading Live API...");
        schedule(waitForLive, 250);
    } else {
        log("Live API did not become ready after " + maxInitAttempts + " attempts.");
        ui("Live API not ready - reload device");
    }
}

function trackCount() {
    try {
        return getLiveSet().getcount("tracks");
    } catch (e) {
        log("Could not count tracks: " + e);
        return -1;
    }
}

function getTrack(index) {
    return new LiveAPI("live_set tracks " + index);
}

function val(api, prop, fallback) {
    try {
        var v = api.get(prop);
        if (v === null || typeof v === "undefined") return fallback;
        if (Array.isArray(v) && v.length === 1) return v[0];
        return v;
    } catch (e) {
        return fallback;
    }
}

function boolVal(api, prop) {
    var v = val(api, prop, 0);
    if (Array.isArray(v)) v = v[0];
    return Number(v) === 1;
}

function getName(api, index) {
    var n = val(api, "name", "Track " + (index + 1));
    if (Array.isArray(n)) n = n.join(" ");
    return String(n);
}

function hasSkipName(name) {
    if (!skipNameTag) return false;
    return String(name || "").toLowerCase().indexOf("skip") >= 0;
}

function idFromLiveApiProp(v) {
    if (v === null || typeof v === "undefined") return 0;

    if (Array.isArray(v)) {
        for (var i = 0; i < v.length; i++) {
            var n = parseInt(v[i], 10);
            if (!isNaN(n) && n > 0) return n;
        }
        return 0;
    }

    if (typeof v === "number") return v;

    var s = String(v);
    var m = s.match(/-?\d+/g);
    if (m && m.length) {
        var parsed = parseInt(m[m.length - 1], 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 0;
}

function detectHostTrack() {
    hostTrackId = 0;
    hostTrackName = "";
    hostTrackIndex = -1;

    if (!liveSetReady()) return false;

    // Clean host detection: only scan tracks/devices and compare with this_device id.
    try {
        var thisDevice = new LiveAPI("this_device");
        var thisId = Number(thisDevice.id);
        var count = trackCount();

        if (count >= 0 && thisId) {
            for (var i = 0; i < count; i++) {
                var track = getTrack(i);
                var dcount = 0;

                try {
                    dcount = track.getcount("devices");
                } catch (e1) {
                    dcount = 0;
                }

                for (var d = 0; d < dcount; d++) {
                    try {
                        var device = new LiveAPI("live_set tracks " + i + " devices " + d);

                        if (Number(device.id) === thisId) {
                            hostTrackId = Number(track.id);
                            hostTrackIndex = i;
                            hostTrackName = getName(track, i);
                            break;
                        }
                    } catch (e2) {}
                }

                if (hostTrackId) break;
            }
        }
    } catch (e3) {}

    if (hostTrackId) {
        log("Host track detected: " + (hostTrackIndex + 1) + ". " + hostTrackName + " id=" + hostTrackId);
        return true;
    }

    log("Warning: could not auto-detect host track. Put Ice Age on an empty utility track if needed.");
    return false;
}

function kindOf(api) {
    var hasMidi = boolVal(api, "has_midi_input");
    var hasAudio = boolVal(api, "has_audio_input");

    if (hasMidi && !hasAudio) return "midi";
    if (hasAudio && !hasMidi) return "audio";
    if (hasAudio && hasMidi) return "hybrid";
    return "unknown";
}

function infoForTrack(index) {
    var api = getTrack(index);
    var name = getName(api, index);
    var id = api.id;

    return {
        index: index,
        humanIndex: index + 1,
        id: id,
        name: name,
        kind: kindOf(api),
        canFreeze: boolVal(api, "can_be_frozen"),
        isFrozen: boolVal(api, "is_frozen"),
        // Safe group detection. This reads only is_foldable, never fold_state.
        // fold_state is the property that caused the old collapse spam.
        isGroupTrack: boolVal(api, "is_foldable"),
        isHostTrack: hostTrackId && Number(id) === Number(hostTrackId),
        skipByName: hasSkipName(name)
    };
}

function findTrackById(id) {
    var count = trackCount();
    if (count < 0) return null;

    for (var i = 0; i < count; i++) {
        var t = infoForTrack(i);
        if (Number(t.id) === Number(id)) return t;
    }
    return null;
}

function eligibleReason(t, mode) {
    if (!t) return "missing track";
    if (t.isHostTrack) return "host device track";
    if (t.isGroupTrack) return "group/foldable track";
    if (t.skipByName) return "name contains skip";
    if (t.isFrozen) return "already frozen";
    if (!t.canFreeze) return "cannot be frozen / unsupported track";

    if (mode === "audio" && t.kind !== "audio") return "mode mismatch";
    if (mode === "midi" && t.kind !== "midi") return "mode mismatch";
    if (mode === "all" && !(t.kind === "audio" || t.kind === "midi" || t.kind === "hybrid")) return "not a normal audio/midi track";

    return "";
}

function default_setup() {
    if (setupDone) {
        log("Default setup already initialized - ignoring duplicate loadbang.");
        return;
    }

    setupDone = 1;
    dryRun = 0;
    skipNameTag = 1;
    settleMs = 500;
    pollMs = 250;
    timeoutMs = 60000;
    stopping = 0;

    initAttempts = 0;
    ui("Loading Live API...");
    schedule(waitForLive, 250);

    log("Ice Age v1.0.2 GROUP UNFOLD FIX loaded.");
    log("Flow: scan -> strict queue -> select track -> arm marker -> shortcut -> poll -> next -> auto stop.");
    log("No unsupported class_name reads. Group tracks are temporarily unfolded before queue building, then restored.");
}

function skip_name(v) {
    skipNameTag = Number(v) ? 1 : 0;
    log("Skip tracks by name containing 'skip': " + (skipNameTag ? "ON" : "OFF"));
    ui("Skip name " + (skipNameTag ? "ON" : "OFF"));
}

function skip_groups(v) {
    log("Groups are skipped automatically before freezing. Received skip_groups " + v);
}

function restore_groups(v) {
    restoreGroupFolds = Number(v) ? 1 : 0;
    log("Restore group fold state after queue: " + (restoreGroupFolds ? "ON" : "OFF"));
}

function timeout(v) {
    var n = parseInt(v, 10);
    if (isNaN(n) || n < 5000) n = 5000;
    timeoutMs = n;
    log("Freeze marker timeout per track: " + timeoutMs + " ms");
}

function settle(v) {
    var n = parseInt(v, 10);
    if (isNaN(n) || n < 0) n = 0;
    settleMs = n;
    log("Settle time after detected freeze: " + settleMs + " ms");
}

function delay(v) { settle(v); }

function poll(v) {
    var n = parseInt(v, 10);
    if (isNaN(n) || n < 100) n = 100;
    pollMs = n;
    log("Polling interval: " + pollMs + " ms");
}

function dryrun(v) {
    dryRun = Number(v) ? 1 : 0;
    log("Dry run: " + (dryRun ? "ON" : "OFF"));
    ui("Dry Run " + (dryRun ? "ON" : "OFF"));
}

function debug(v) {
    debugMode = Number(v) ? 1 : 0;
    log("Debug mode: " + (debugMode ? "ON" : "OFF"));
    ui("Debug " + (debugMode ? "ON" : "OFF"));
}

function reset() {
    stop();
    ui("Ready");
    log("Reset complete.");
}

function RESET() { reset(); }
function Reset() { reset(); }

function scan() {
    if (!liveSetReady()) {
        ui("Live API loading...");
        initAttempts = 0;
        schedule(waitForLive, 250);
        return;
    }

    detectHostTrack();

    var count = trackCount();
    var lines = [];
    var audio = 0;
    var midi = 0;
    var hybrid = 0;
    var eligibleAll = 0;
    var skipNamed = 0;
    var groupTracks = 0;
    var already = 0;

    lines.push("Ice Age scan - tracks: " + count);
    lines.push("Host track: " + (hostTrackId ? ((hostTrackIndex + 1) + ". " + hostTrackName + " id=" + hostTrackId) : "not detected"));
    lines.push("Skip tracks with name containing 'skip': " + Number(skipNameTag));

    if (count >= 0) {
        for (var i = 0; i < count; i++) {
            var t = infoForTrack(i);
            var reason = eligibleReason(t, "all");

            if (t.kind === "audio") audio++;
            if (t.kind === "midi") midi++;
            if (t.kind === "hybrid") hybrid++;
            if (!reason) eligibleAll++;
            if (t.skipByName) skipNamed++;
            if (t.isGroupTrack) groupTracks++;
            if (t.isFrozen) already++;

            lines.push(
                t.humanIndex + ". " + t.name +
                " [" + t.kind + "]" +
                " canFreeze=" + Number(t.canFreeze) +
                " frozen=" + Number(t.isFrozen) +
                " group=" + Number(t.isGroupTrack) +
                " host=" + Number(t.isHostTrack) +
                " skip=" + Number(t.skipByName) +
                " eligibleAll=" + Number(!reason) +
                (reason ? " reason=" + reason : "")
            );
        }
    }

    log(lines.join("\n"));
    ui("Scan: audio=" + audio + " / midi=" + midi + " / groups=" + groupTracks + " / skip=" + skipNamed + " / queue=" + eligibleAll);
}

function buildQueue(mode) {
    detectHostTrack();

    var count = trackCount();
    var q = [];
    var skipped = 0;
    var frozenBefore = 0;

    if (count < 0) {
        report.failed++;
        report.items.push("Live API not ready");
        return q;
    }

    for (var i = 0; i < count; i++) {
        var t = infoForTrack(i);
        var reason = eligibleReason(t, mode);

        if (reason) {
            skipped++;
            if (reason === "already frozen") frozenBefore++;
            report.items.push(t.humanIndex + ". " + t.name + " - skipped: " + reason);
            continue;
        }

        q.push({
            index: t.index,
            humanIndex: t.humanIndex,
            id: t.id,
            name: t.name,
            kind: t.kind
        });
    }

    report.found = count;
    report.queued = q.length;
    report.skipped = skipped;
    report.frozenBefore = frozenBefore;
    return q;
}

function freeze_audio() { startFreeze("audio"); }
function freeze_midi() { startFreeze("midi"); }
function ice_age() { startFreeze("all"); }
function freeze_all() { ice_age(); }


function rememberGroupFoldState(api, index, name) {
    try {
        var id = Number(api.id);
        if (!id) return;
        if (groupFoldStateCache[String(id)]) return;

        var state = val(api, "fold_state", -1);
        if (Array.isArray(state)) state = state[0];
        state = parseInt(state, 10);
        if (isNaN(state)) return;

        groupFoldStateCache[String(id)] = {
            id: id,
            index: index,
            name: name,
            state: state
        };
    } catch (e) {}
}

function unfoldAllGroupsSafe(pass) {
    var count = trackCount();
    if (count < 0) return 0;

    var groups = 0;
    var touched = 0;

    for (var i = 0; i < count; i++) {
        try {
            var api = getTrack(i);
            var name = getName(api, i);

            // Read fold_state only after is_foldable is confirmed.
            if (!boolVal(api, "is_foldable")) continue;

            groups++;
            rememberGroupFoldState(api, i, name);

            try {
                api.set("fold_state", 0); // 0 = unfolded/open in Live.
                touched++;
            } catch (e1) {
                log("Could not unfold group track " + (i + 1) + ". " + name + ": " + e1);
            }
        } catch (e2) {}
    }

    if (groups > 0) {
        log("Group prep pass " + (pass + 1) + ": unfolded/touched " + touched + " group track(s).");
    }

    return touched;
}

function restoreGroupFoldStatesSafe() {
    if (!restoreGroupFolds) return;

    var keys = [];
    for (var k in groupFoldStateCache) {
        if (groupFoldStateCache.hasOwnProperty(k)) keys.push(k);
    }

    if (!keys.length) return;

    // Restore lower/child tracks first, then parent groups.
    keys.sort(function (a, b) {
        return Number(groupFoldStateCache[b].index) - Number(groupFoldStateCache[a].index);
    });

    for (var i = 0; i < keys.length; i++) {
        var saved = groupFoldStateCache[keys[i]];
        try {
            var api = new LiveAPI("id " + saved.id);
            if (api && boolVal(api, "is_foldable")) {
                api.set("fold_state", saved.state);
            }
        } catch (e) {}
    }

    log("Group fold states restored.");
    groupFoldStateCache = {};
}

function prepareGroupsThenStart(mode, pass) {
    if (running || stopping) return;

    if (!liveSetReady()) {
        pendingMode = mode;
        initAttempts = 0;
        ui("Preparing Live API...");
        schedule(waitForLive, 250);
        return;
    }

    if (pass === 0) {
        groupFoldStateCache = {};
        groupPrepActive = 1;
        ui("Preparing groups...");
        log("Preparing groups before freeze queue. Closed groups will be opened so child tracks can be selected.");
    }

    unfoldAllGroupsSafe(pass);

    if (pass < groupUnfoldPasses - 1) {
        schedule(function () { prepareGroupsThenStart(mode, pass + 1); }, groupUnfoldSettleMs);
        return;
    }

    schedule(function () {
        groupPrepActive = 0;
        startFreezePrepared(mode);
    }, groupUnfoldSettleMs);
}

function resetEngine(reason) {
    cancelTasks();
    groupPrepActive = 0;
    restoreGroupFoldStatesSafe();
    running = 0;
    pendingMode = null;
    queue = [];
    current = null;
    totalQueue = 0;
    processedCount = 0;
    stopping = 0;
    log("Auto reset: " + reason);
    ui("Reset");
}

function startFreeze(mode) {
    if (running || stopping || groupPrepActive) {
        log("New " + mode + " request while Ice Age was still active. Auto-resetting first.");
        resetEngine("new start request");
        schedule(function () { startFreeze(mode); }, 150);
        return;
    }

    if (!liveSetReady()) {
        pendingMode = mode;
        initAttempts = 0;
        ui("Preparing Live API...");
        schedule(waitForLive, 250);
        return;
    }

    prepareGroupsThenStart(mode, 0);
}

function startFreezePrepared(mode) {
    if (running || stopping) return;

    if (!liveSetReady()) {
        pendingMode = mode;
        initAttempts = 0;
        ui("Preparing Live API...");
        schedule(waitForLive, 250);
        return;
    }

    currentMode = mode;
    report = emptyReport(mode);
    queue = buildQueue(mode);
    running = 1;
    stopping = 0;
    current = null;
    totalQueue = queue.length;
    processedCount = 0;

    var queuedNames = [];
    for (var i = 0; i < queue.length; i++) queuedNames.push(queue[i].humanIndex + ". " + queue[i].name + " [" + queue[i].kind + "]");

    log(
        "Ice Age v1.0.2 start - mode: " + mode +
        " / dryRun=" + Number(dryRun) +
        " / queued=" + queue.length +
        " / poll=" + pollMs + " ms" +
        " / settle=" + settleMs + " ms" +
        " / timeout=" + timeoutMs + " ms" +
        "\nQueue:\n" + (queuedNames.length ? queuedNames.join("\n") : "(empty)")
    );

    if (queue.length === 0) {
        finishAndReset("complete");
        return;
    }

    ui("Ice Age - 0 / " + totalQueue);
    schedule(runNext, 100);
}

function selectTrack(t) {
    var view = getView();
    try {
        view.set("selected_track", "id", t.id);
        return true;
    } catch (e1) {
        try {
            view.set("selected_track", "id " + t.id);
            return true;
        } catch (e2) {
            log("Could not select track " + t.humanIndex + " (" + t.name + "): " + e2);
            return false;
        }
    }
}

function runNext() {
    if (!running || stopping) return;

    if (queue.length === 0) {
        finishAndReset("complete");
        return;
    }

    var item = queue.shift();
    var fresh = findTrackById(item.id);

    if (!fresh) {
        hardStop("queued track disappeared: " + item.name);
        return;
    }

    var reason = eligibleReason(fresh, currentMode);
    if (reason) {
        // This should be rare because the queue was already filtered.
        report.skipped++;
        processedCount++;
        report.items.push(fresh.humanIndex + ". " + fresh.name + " - skipped at runtime: " + reason);
        ui("Skipped - " + processedCount + " / " + totalQueue);
        schedule(runNext, 100);
        return;
    }

    jobCounter++;
    fresh.jobId = jobCounter;
    current = fresh;

    log("Selecting track " + fresh.humanIndex + ": " + fresh.name + " [" + fresh.kind + "]");
    ui("Selecting - " + processedCount + " / " + totalQueue);

    if (!selectTrack(fresh)) {
        hardStop("could not select track: " + fresh.name);
        return;
    }

    if (dryRun) {
        report.done++;
        processedCount++;
        report.items.push(fresh.humanIndex + ". " + fresh.name + " - dry-run: would freeze");
        ui("Dry run - " + processedCount + " / " + totalQueue);
        current = null;
        schedule(runNext, 100);
        return;
    }

    current.freezeMarkerAt = nowMs();
    current.shortcutReturned = 0;

    var job = current.jobId;
    var trackId = current.id;

    log("Freeze marker armed before shortcut for track " + current.humanIndex + ": " + current.name);
    ui("Freezing - " + (processedCount + 1) + " / " + totalQueue + " / 0s");

    // Important: arm both checkers BEFORE the shortcut request.
    // If Ableton blocks/cancels the freeze operation, these tasks are already queued
    // and will run as soon as Max gets control back.
    schedule(function () { checkFreezeResult(job, trackId); }, pollMs);
    outlet(0, "shortcut", current.jobId);
}

function shortcut_done(jobId) {
    if (!running || current === null || stopping) return;

    var id = parseInt(jobId, 10);
    if (id !== current.jobId) {
        log("Ignoring shortcut_done for old job " + id + ", current is " + current.jobId);
        return;
    }

    current.shortcutReturned = 1;
    log("Shortcut command returned for track " + current.humanIndex + ". Freeze marker is already checking result.");
}

function shortcut_failed(jobId, reason) {
    if (!running || current === null || stopping) return;
    hardStop("shortcut error on " + current.name + ": " + reason);
}

function checkFreezeResult(jobId, trackId) {
    if (!running || current === null || stopping) return;
    if (Number(current.jobId) !== Number(jobId)) return;
    if (Number(current.id) !== Number(trackId)) return;

    var updated = findTrackById(trackId);
    var elapsed = nowMs() - current.freezeMarkerAt;

    if (!updated) {
        hardStop("track disappeared while checking freeze result: " + current.name);
        return;
    }

    if (updated.isFrozen) {
        report.done++;
        processedCount++;
        report.items.push(updated.humanIndex + ". " + updated.name + " - frozen");
        log("Track frozen confirmed: " + updated.humanIndex + ". " + updated.name + ". Next in " + settleMs + " ms.");
        ui("Frozen - " + processedCount + " / " + totalQueue);
        current = null;
        schedule(runNext, settleMs);
        return;
    }

    if (elapsed >= timeoutMs) {
        hardStop("freeze cancelled/interrupted/timeout on " + updated.name + " after " + timeoutMs + " ms");
        return;
    }

    ui("Freezing - " + (processedCount + 1) + " / " + totalQueue + " / " + Math.floor(elapsed / 1000) + "s");

    schedule(function () {
        checkFreezeResult(jobId, trackId);
    }, pollMs);
}

function hardStop(reason) {
    if (stopping) return;
    stopping = 1;

    report.failed++;
    report.stopped = 1;
    report.items.push("STOPPED: " + reason);

    log("AUTO STOP: " + reason);
    ui("Stopped - " + cleanStatus(reason));

    running = 0;
    pendingMode = null;
    queue = [];
    current = null;
    totalQueue = 0;
    processedCount = 0;
    groupPrepActive = 0;
    cancelTasks();
    restoreGroupFoldStatesSafe();

    finishReportOnly();
}

function finishAndReset(reason) {
    if (stopping) return;

    log("Queue finished. Auto stop/reset: " + reason);
    ui("Complete - " + report.done + " frozen / " + report.skipped + " skipped / " + report.failed + " failed");

    running = 0;
    pendingMode = null;
    queue = [];
    current = null;
    totalQueue = 0;
    processedCount = 0;
    groupPrepActive = 0;
    cancelTasks();
    restoreGroupFoldStatesSafe();

    finishReportOnly();
}

function finishReportOnly() {
    var lines = [];
    lines.push("Ice Age report - mode: " + report.mode);
    lines.push(
        "Queued: " + report.queued +
        " / Frozen/dry-run done: " + report.done +
        " / Already frozen: " + report.frozenBefore +
        " / Skipped: " + report.skipped +
        " / Failed: " + report.failed +
        " / AutoStopped: " + report.stopped
    );

    for (var i = 0; i < report.items.length; i++) lines.push("* " + report.items[i]);
    log(lines.join("\n"));
}

function finishReport() { finishReportOnly(); }

function stuck_next() {
    if (!running) {
        log("Not running.");
        return;
    }
    hardStop("manual stuck_next requested");
}

function stop() {
    running = 0;
    pendingMode = null;
    queue = [];
    current = null;
    totalQueue = 0;
    processedCount = 0;
    stopping = 0;
    groupPrepActive = 0;
    cancelTasks();
    restoreGroupFoldStatesSafe();
    ui("Stopped");
    log("Stopped.");
}

function STOP() { stop(); }
function Stop() { stop(); }

function loadbang() { default_setup(); }

function FREEZE() {
    var args = arrayfromargs(arguments);
    var target = args.join(" ").toLowerCase();

    if (target.indexOf("audio") >= 0) {
        freeze_audio();
        return;
    }

    if (target.indexOf("midi") >= 0) {
        freeze_midi();
        return;
    }

    log("Unknown FREEZE target: " + args.join(" "));
}

function Freeze() { FREEZE.apply(this, arguments); }

function ICE() {
    var args = arrayfromargs(arguments);
    var target = args.join(" ").toLowerCase();

    if (target.indexOf("age") >= 0 || target.length === 0) {
        ice_age();
        return;
    }

    log("Unknown ICE target: " + args.join(" "));
}

function Ice() { ICE.apply(this, arguments); }

function anything() {
    var args = arrayfromargs(arguments);
    var msg = String(messagename || "");

    if (msg === "STOP" || msg === "Stop" || msg === "stop") {
        stop();
        return;
    }

    if (msg === "RESET" || msg === "Reset" || msg === "reset") {
        reset();
        return;
    }

    log("Unknown message: " + messagename + (args.length ? " " + args.join(" ") : ""));
}
