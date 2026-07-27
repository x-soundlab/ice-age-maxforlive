/*
ICE AGE v1.1.0
Max for Live freeze assistant by Aynix.x.

Responsibilities:
- Wait until both the Live API and the Node helper are available.
- Detect and exclude the track that contains ICE AGE.
- Temporarily unfold group tracks.
- Build one strict queue of eligible tracks.
- Select and verify each track before requesting Live's Freeze shortcut.
- Poll only the current track by its Live object ID.
- Restore group folds and the user's previous track selection.
*/

autowatch = 1;
inlets = 1;
outlets = 3;

// Outlet 0 -> node.script
// Outlet 1 -> Max console/debug print
// Outlet 2 -> visible status text

var VERSION = "1.1.0";

var pollMs = 250;
var settleMs = 500;
var selectionDelayMs = 180;
var timeoutMs = 900000; // 15 minutes per track.

var liveReady = 0;
var nodeReady = 0;
var nodePlatform = "";
var setupDone = 0;

var running = 0;
var stopRequested = 0;
var pendingMode = null;
var currentMode = "all";
var queue = [];
var current = null;
var totalQueue = 0;
var processedCount = 0;
var jobCounter = 0;
var runToken = 0;

var activeTasks = [];

var hostTrackId = 0;
var hostTrackIndex = -1;
var hostTrackName = "";
var previousSelectedTrackId = 0;

var groupFoldStateCache = {};
var groupUnfoldPasses = 3;
var groupUnfoldSettleMs = 200;

var report = createReport("");

function nowMs() {
    return (new Date()).getTime();
}

function cleanText(value) {
    var text = String(value === null || typeof value === "undefined" ? "" : value);
    text = text.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");
    if (text.length > 120) text = text.substring(0, 117) + "...";
    return text;
}

function log(message) {
    var text = cleanText(message);
    post("[ICE AGE] " + text + "\n");
    outlet(1, text);
}

function logBlock(message) {
    var text = String(message || "");
    post("[ICE AGE] " + text + "\n");
    outlet(1, text);
}

function ui(message) {
    outlet(2, "set", cleanText(message));
}

function platformLabel() {
    if (nodePlatform === "win32") return "Windows";
    if (nodePlatform === "darwin") return "macOS";
    return nodePlatform || "helper";
}

function schedule(fn, delayMsValue) {
    var task = new Task(function () {
        try {
            fn();
        } finally {
            removeTask(task);
        }
    }, this);

    activeTasks.push(task);
    task.schedule(Math.max(0, Number(delayMsValue) || 0));
    return task;
}

function scheduleForRun(token, fn, delayMsValue) {
    return schedule(function () {
        if (token !== runToken) return;
        fn();
    }, delayMsValue);
}

function removeTask(task) {
    for (var i = activeTasks.length - 1; i >= 0; i--) {
        if (activeTasks[i] === task) {
            activeTasks.splice(i, 1);
            return;
        }
    }
}

function cancelTasks() {
    for (var i = 0; i < activeTasks.length; i++) {
        try {
            activeTasks[i].cancel();
        } catch (error) {}
    }
    activeTasks = [];
}

function createReport(mode) {
    return {
        mode: mode,
        found: 0,
        queued: 0,
        done: 0,
        skipped: 0,
        alreadyFrozen: 0,
        failed: 0,
        stopped: 0
    };
}

function getLiveSet() {
    return new LiveAPI("live_set");
}

function getView() {
    return new LiveAPI("live_set view");
}

function getTrack(index) {
    return new LiveAPI("live_set tracks " + index);
}

function getTrackById(id) {
    try {
        var api = new LiveAPI("id " + Number(id));
        if (!api || !Number(api.id)) return null;
        return api;
    } catch (error) {
        return null;
    }
}

function value(api, property, fallback) {
    try {
        var result = api.get(property);
        if (result === null || typeof result === "undefined") return fallback;
        if (Array.isArray(result) && result.length === 1) return result[0];
        return result;
    } catch (error) {
        return fallback;
    }
}

function boolValue(api, property) {
    var result = value(api, property, 0);
    if (Array.isArray(result)) result = result[0];
    return Number(result) === 1;
}

function idFromValue(result) {
    if (result === null || typeof result === "undefined") return 0;

    if (Array.isArray(result)) {
        for (var i = result.length - 1; i >= 0; i--) {
            var arrayNumber = parseInt(result[i], 10);
            if (!isNaN(arrayNumber) && arrayNumber > 0) return arrayNumber;
        }
        return 0;
    }

    if (typeof result === "number") return result > 0 ? result : 0;

    var matches = String(result).match(/\d+/g);
    if (!matches || !matches.length) return 0;

    var number = parseInt(matches[matches.length - 1], 10);
    return isNaN(number) ? 0 : number;
}

function trackCount() {
    try {
        var count = getLiveSet().getcount("tracks");
        count = parseInt(count, 10);
        return isNaN(count) ? -1 : count;
    } catch (error) {
        return -1;
    }
}

function liveSetIsReady() {
    return trackCount() >= 0;
}

function getTrackName(api, fallback) {
    var name = value(api, "name", fallback || "Unnamed track");
    if (Array.isArray(name)) name = name.join(" ");
    return String(name);
}

function trackKind(api) {
    var hasMidiInput = boolValue(api, "has_midi_input");
    var hasAudioInput = boolValue(api, "has_audio_input");

    if (hasMidiInput && !hasAudioInput) return "midi";
    if (hasAudioInput && !hasMidiInput) return "audio";
    if (hasMidiInput && hasAudioInput) return "hybrid";
    return "unknown";
}

function trackInfo(api, index) {
    var name = getTrackName(api, "Track " + (index + 1));

    return {
        id: Number(api.id),
        index: index,
        humanIndex: index + 1,
        name: name,
        kind: trackKind(api),
        canFreeze: boolValue(api, "can_be_frozen"),
        isFrozen: boolValue(api, "is_frozen"),
        isGroup: boolValue(api, "is_foldable"),
        isHost: hostTrackId && Number(api.id) === Number(hostTrackId),
        skipByName: name.toLowerCase().indexOf("skip") >= 0
    };
}

function eligibilityReason(info, mode) {
    if (!info || !info.id) return "track unavailable";
    if (info.isHost) return "ICE AGE host track";
    if (info.isGroup) return "group track";
    if (info.skipByName) return "name contains skip";
    if (info.isFrozen) return "already frozen";
    if (!info.canFreeze) return "cannot be frozen";

    if (mode === "audio" && info.kind !== "audio") return "not an audio track";
    if (mode === "midi" && info.kind !== "midi") return "not a MIDI track";
    if (
        mode === "all" &&
        info.kind !== "audio" &&
        info.kind !== "midi" &&
        info.kind !== "hybrid"
    ) {
        return "unsupported track type";
    }

    return "";
}

function probeLive(attempt) {
    if (liveSetIsReady()) {
        liveReady = 1;
        refreshIdleStatus();
        return;
    }

    liveReady = 0;
    if (attempt < 80) {
        ui("Loading Live API...");
        schedule(function () {
            probeLive(attempt + 1);
        }, 250);
    } else {
        ui("Live API unavailable - reload ICE AGE");
        log("Live API did not become ready.");
    }
}

function verifyHelperStartup() {
    if (!nodeReady && !running && pendingMode === null) {
        ui("Shortcut helper unavailable - reload ICE AGE");
        log("Node shortcut helper did not announce readiness.");
    }
}

function refreshIdleStatus() {
    if (running || pendingMode !== null) return;

    if (liveReady && nodeReady) {
        ui("Ready - " + platformLabel() + " helper connected");
    } else if (!liveReady) {
        ui("Loading Live API...");
    } else {
        ui("Loading shortcut helper...");
    }
}

function node_ready(platform) {
    nodeReady = 1;
    nodePlatform = cleanText(platform);
    log("Shortcut helper ready: " + platformLabel() + ".");

    if (pendingMode !== null && !running) {
        var mode = pendingMode;
        pendingMode = null;
        beginRun(mode);
        return;
    }

    refreshIdleStatus();
}

function node_stopped() {
    nodeReady = 0;
    if (running) {
        failRun("shortcut helper stopped");
    } else {
        refreshIdleStatus();
    }
}

function default_setup() {
    if (setupDone) return;
    setupDone = 1;

    ui("Starting ICE AGE...");
    log("ICE AGE v" + VERSION + " loaded.");

    probeLive(0);

    // node.script announces node_ready when its asynchronous startup finishes.
    // Waiting for that event avoids sending commands while Node is still loading.
    schedule(verifyHelperStartup, 20000);
}

function loadbang() {
    default_setup();
}

function detectHostTrack() {
    hostTrackId = 0;
    hostTrackIndex = -1;
    hostTrackName = "";

    try {
        var thisDevice = new LiveAPI("this_device");
        var thisDeviceId = Number(thisDevice.id);
        var count = trackCount();

        if (!thisDeviceId || count < 0) return false;

        for (var i = 0; i < count; i++) {
            var track = getTrack(i);
            var deviceCount = 0;

            try {
                deviceCount = track.getcount("devices");
            } catch (error) {
                deviceCount = 0;
            }

            for (var d = 0; d < deviceCount; d++) {
                try {
                    var device = new LiveAPI("live_set tracks " + i + " devices " + d);
                    if (Number(device.id) === thisDeviceId) {
                        hostTrackId = Number(track.id);
                        hostTrackIndex = i;
                        hostTrackName = getTrackName(track, "Track " + (i + 1));
                        log(
                            "Host track: " +
                            (hostTrackIndex + 1) +
                            ". " +
                            hostTrackName
                        );
                        return true;
                    }
                } catch (deviceError) {}
            }
        }
    } catch (error) {
        log("Host detection error: " + error);
    }

    return false;
}

function getSelectedTrackId() {
    try {
        return idFromValue(getView().get("selected_track"));
    } catch (error) {
        return 0;
    }
}

function setSelectedTrack(id) {
    if (!id) return false;

    try {
        getView().set("selected_track", "id", Number(id));
        return true;
    } catch (firstError) {
        try {
            getView().set("selected_track", "id " + Number(id));
            return true;
        } catch (secondError) {
            return false;
        }
    }
}

function restorePreviousSelection() {
    if (!previousSelectedTrackId) return;
    if (getTrackById(previousSelectedTrackId)) {
        setSelectedTrack(previousSelectedTrackId);
    }
    previousSelectedTrackId = 0;
}

function rememberGroupState(api, index, name) {
    var id = Number(api.id);
    if (!id || groupFoldStateCache[String(id)]) return;

    var foldState = value(api, "fold_state", -1);
    if (Array.isArray(foldState)) foldState = foldState[0];
    foldState = parseInt(foldState, 10);

    if (isNaN(foldState)) return;

    groupFoldStateCache[String(id)] = {
        id: id,
        index: index,
        name: name,
        state: foldState
    };
}

function unfoldGroups(pass) {
    var count = trackCount();
    var touched = 0;

    if (count < 0) return touched;

    for (var i = 0; i < count; i++) {
        try {
            var api = getTrack(i);
            if (!boolValue(api, "is_foldable")) continue;

            var name = getTrackName(api, "Group " + (i + 1));
            rememberGroupState(api, i, name);
            api.set("fold_state", 0);
            touched++;
        } catch (error) {}
    }

    if (touched) {
        log("Group preparation pass " + (pass + 1) + ": " + touched + " group(s).");
    }

    return touched;
}

function restoreGroupStates() {
    var keys = [];
    var key;

    for (key in groupFoldStateCache) {
        if (groupFoldStateCache.hasOwnProperty(key)) keys.push(key);
    }

    keys.sort(function (left, right) {
        return (
            Number(groupFoldStateCache[right].index) -
            Number(groupFoldStateCache[left].index)
        );
    });

    for (var i = 0; i < keys.length; i++) {
        var saved = groupFoldStateCache[keys[i]];
        var api = getTrackById(saved.id);

        if (!api || !boolValue(api, "is_foldable")) continue;

        try {
            api.set("fold_state", saved.state);
        } catch (error) {}
    }

    if (keys.length) log("Group fold states restored.");
    groupFoldStateCache = {};
}

function requestStart(mode) {
    if (running || pendingMode !== null) {
        ui("ICE AGE is busy - use STOP first");
        return;
    }

    if (!liveSetIsReady()) {
        liveReady = 0;
        ui("Live API unavailable - retrying...");
        probeLive(0);
        return;
    }

    liveReady = 1;
    pendingMode = mode;
    nodeReady = 0;
    ui("Checking shortcut helper...");
    outlet(0, "ping");

    schedule(function () {
        if (pendingMode === mode && !nodeReady && !running) {
            pendingMode = null;
            ui("Shortcut helper unavailable - reload ICE AGE");
            log("Start cancelled because the Node helper did not answer.");
        }
    }, 2500);
}

function freeze_audio() {
    requestStart("audio");
}

function freeze_midi() {
    requestStart("midi");
}

function ice_age() {
    requestStart("all");
}

function beginRun(mode) {
    if (running) return;

    if (!detectHostTrack()) {
        ui("Host track not detected - place ICE AGE directly on a track");
        log("Run cancelled: the host track could not be detected.");
        return;
    }

    runToken++;
    var token = runToken;

    running = 1;
    stopRequested = 0;
    currentMode = mode;
    queue = [];
    current = null;
    totalQueue = 0;
    processedCount = 0;
    previousSelectedTrackId = getSelectedTrackId();
    groupFoldStateCache = {};
    report = createReport(mode);

    ui("Preparing groups...");
    prepareGroupPass(token, 0);
}

function prepareGroupPass(token, pass) {
    if (!running || token !== runToken) return;

    if (stopRequested) {
        finishStopped("Stopped by user");
        return;
    }

    unfoldGroups(pass);

    if (pass < groupUnfoldPasses - 1) {
        scheduleForRun(token, function () {
            prepareGroupPass(token, pass + 1);
        }, groupUnfoldSettleMs);
        return;
    }

    scheduleForRun(token, function () {
        buildQueueAndStart(token);
    }, groupUnfoldSettleMs);
}

function buildQueue(mode) {
    var count = trackCount();
    var result = [];

    report.found = Math.max(0, count);

    if (count < 0) return result;

    for (var i = 0; i < count; i++) {
        var info;

        try {
            info = trackInfo(getTrack(i), i);
        } catch (error) {
            report.skipped++;
            continue;
        }

        var reason = eligibilityReason(info, mode);

        if (reason) {
            report.skipped++;
            if (reason === "already frozen") report.alreadyFrozen++;
            log(
                "Skip " +
                info.humanIndex +
                ". " +
                info.name +
                ": " +
                reason
            );
            continue;
        }

        result.push({
            id: info.id,
            index: info.index,
            humanIndex: info.humanIndex,
            name: info.name,
            kind: info.kind
        });
    }

    report.queued = result.length;
    return result;
}

function buildQueueAndStart(token) {
    if (!running || token !== runToken) return;

    queue = buildQueue(currentMode);
    totalQueue = queue.length;

    log(
        "Mode " +
        currentMode +
        ": " +
        totalQueue +
        " queued, " +
        report.skipped +
        " skipped."
    );

    if (!totalQueue) {
        finishComplete();
        return;
    }

    ui("Queued " + totalQueue + " track(s) - starting...");
    scheduleForRun(token, runNext, 100);
}

function runtimeEligibility(item) {
    var api = getTrackById(item.id);
    if (!api) return "track unavailable";

    var info = {
        id: Number(api.id),
        name: getTrackName(api, item.name),
        kind: item.kind,
        canFreeze: boolValue(api, "can_be_frozen"),
        isFrozen: boolValue(api, "is_frozen"),
        isGroup: boolValue(api, "is_foldable"),
        isHost: Number(api.id) === Number(hostTrackId),
        skipByName: getTrackName(api, item.name).toLowerCase().indexOf("skip") >= 0
    };

    return eligibilityReason(info, currentMode);
}

function runNext() {
    if (!running) return;

    if (stopRequested) {
        finishStopped("Stopped by user");
        return;
    }

    if (!queue.length) {
        finishComplete();
        return;
    }

    var item = queue.shift();
    var reason = runtimeEligibility(item);

    if (reason) {
        report.skipped++;
        processedCount++;
        log("Runtime skip " + item.name + ": " + reason);
        ui("Skipped " + processedCount + " / " + totalQueue + " - " + item.name);
        scheduleForRun(runToken, runNext, 100);
        return;
    }

    jobCounter++;
    item.jobId = jobCounter;
    item.startedAt = 0;
    item.pollErrors = 0;
    current = item;

    ui(
        "Selecting " +
        (processedCount + 1) +
        " / " +
        totalQueue +
        " - " +
        item.name
    );

    selectCurrentTrack(0);
}

function selectCurrentTrack(attempt) {
    if (!running || !current) return;

    if (stopRequested) {
        finishStopped("Stopped by user");
        return;
    }

    if (!setSelectedTrack(current.id)) {
        failRun("could not select " + current.name);
        return;
    }

    scheduleForRun(runToken, function () {
        verifyCurrentSelection(attempt);
    }, selectionDelayMs);
}

function verifyCurrentSelection(attempt) {
    if (!running || !current) return;

    if (Number(getSelectedTrackId()) === Number(current.id)) {
        requestCurrentShortcut();
        return;
    }

    if (attempt < 4) {
        log("Selection not confirmed for " + current.name + "; retrying.");
        selectCurrentTrack(attempt + 1);
        return;
    }

    failRun("Live did not confirm the selected track: " + current.name);
}

function requestCurrentShortcut() {
    if (!running || !current) return;

    current.startedAt = nowMs();
    var jobId = current.jobId;
    var trackId = current.id;

    ui(
        "Freezing " +
        (processedCount + 1) +
        " / " +
        totalQueue +
        " - " +
        current.name
    );

    // Start polling before the external shortcut request.
    scheduleForRun(runToken, function () {
        checkCurrentFreeze(jobId, trackId);
    }, pollMs);

    outlet(0, "shortcut", jobId);
}

function shortcut_done(jobId) {
    if (!running || !current) return;
    if (Number(jobId) !== Number(current.jobId)) return;
    log("Freeze shortcut sent for " + current.name + ".");
}

function shortcut_failed(jobId) {
    if (!running || !current) return;
    if (Number(jobId) !== Number(current.jobId)) return;

    var args = arrayfromargs(arguments);
    var reason = args.length > 1 ? args.slice(1).join(" ") : "unknown helper error";
    failRun("shortcut error: " + reason);
}

function checkCurrentFreeze(jobId, trackId) {
    if (!running || !current) return;
    if (Number(jobId) !== Number(current.jobId)) return;
    if (Number(trackId) !== Number(current.id)) return;

    if (stopRequested) {
        finishStopped("Stopped by user");
        return;
    }

    var api = getTrackById(trackId);
    var elapsed = nowMs() - current.startedAt;

    if (!api) {
        current.pollErrors++;

        if (current.pollErrors >= 8) {
            failRun("track unavailable while freezing: " + current.name);
            return;
        }

        scheduleForRun(runToken, function () {
            checkCurrentFreeze(jobId, trackId);
        }, pollMs);
        return;
    }

    current.pollErrors = 0;

    if (boolValue(api, "is_frozen")) {
        report.done++;
        processedCount++;
        log("Frozen: " + current.name + ".");
        ui(
            "Frozen " +
            processedCount +
            " / " +
            totalQueue +
            " - " +
            current.name
        );
        current = null;
        scheduleForRun(runToken, runNext, settleMs);
        return;
    }

    if (elapsed >= timeoutMs) {
        failRun(
            "timeout after " +
            Math.floor(timeoutMs / 60000) +
            " min: " +
            current.name
        );
        return;
    }

    ui(
        "Freezing " +
        (processedCount + 1) +
        " / " +
        totalQueue +
        " - " +
        Math.floor(elapsed / 1000) +
        "s - " +
        current.name
    );

    scheduleForRun(runToken, function () {
        checkCurrentFreeze(jobId, trackId);
    }, pollMs);
}

function cleanupRun() {
    runToken++;
    cancelTasks();

    running = 0;
    stopRequested = 0;
    pendingMode = null;
    queue = [];
    current = null;
    totalQueue = 0;
    processedCount = 0;

    restoreGroupStates();
    restorePreviousSelection();
}

function printReport() {
    logBlock(
        "Report - mode: " +
        report.mode +
        "\nFound: " +
        report.found +
        " / Queued: " +
        report.queued +
        " / Frozen: " +
        report.done +
        " / Already frozen: " +
        report.alreadyFrozen +
        " / Skipped: " +
        report.skipped +
        " / Failed: " +
        report.failed +
        " / Stopped: " +
        report.stopped
    );
}

function finishComplete() {
    var done = report.done;
    var skipped = report.skipped;

    cleanupRun();
    ui("Complete - " + done + " frozen / " + skipped + " skipped");
    printReport();
}

function finishStopped(reason) {
    report.stopped = 1;
    outlet(0, "cancel");
    cleanupRun();
    ui(reason || "Stopped");
    printReport();
}

function failRun(reason) {
    report.failed++;
    outlet(0, "cancel");
    log("Stopped: " + reason);
    cleanupRun();
    ui("Error - " + reason);
    printReport();
}

function stop() {
    if (!running && pendingMode === null) {
        outlet(0, "cancel");
        ui("Stopped - ready for a new operation");
        return;
    }

    stopRequested = 1;
    finishStopped("Stopped by user");
}

function reset() {
    stop();
    nodeReady = 0;
    liveReady = liveSetIsReady() ? 1 : 0;
    ui("Restarting checks...");
    probeLive(0);
    outlet(0, "ping");
    schedule(verifyHelperStartup, 2500);
}

function scan() {
    if (!liveSetIsReady()) {
        ui("Live API unavailable");
        return;
    }

    if (!detectHostTrack()) {
        ui("Host track not detected");
        return;
    }

    var count = trackCount();
    var lines = ["Scan - " + count + " track(s)"];

    for (var i = 0; i < count; i++) {
        var info = trackInfo(getTrack(i), i);
        var reason = eligibilityReason(info, "all");
        lines.push(
            info.humanIndex +
            ". " +
            info.name +
            " [" +
            info.kind +
            "]" +
            (reason ? " - " + reason : " - eligible")
        );
    }

    logBlock(lines.join("\n"));
    ui("Scan complete - see Max console");
}

function timeout(valueInMs) {
    var parsed = parseInt(valueInMs, 10);
    if (isNaN(parsed) || parsed < 60000) parsed = 60000;
    timeoutMs = parsed;
    log("Timeout set to " + timeoutMs + " ms.");
}

function poll(valueInMs) {
    var parsed = parseInt(valueInMs, 10);
    if (isNaN(parsed) || parsed < 100) parsed = 100;
    pollMs = parsed;
    log("Poll interval set to " + pollMs + " ms.");
}

function settle(valueInMs) {
    var parsed = parseInt(valueInMs, 10);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    settleMs = parsed;
    log("Settle delay set to " + settleMs + " ms.");
}

// Compatibility with the labels used by the visible Max message buttons.
function FREEZE() {
    var target = arrayfromargs(arguments).join(" ").toLowerCase();
    if (target.indexOf("audio") >= 0) freeze_audio();
    else if (target.indexOf("midi") >= 0) freeze_midi();
    else log("Unknown FREEZE target: " + target);
}

function ICE() {
    var target = arrayfromargs(arguments).join(" ").toLowerCase();
    if (!target || target.indexOf("age") >= 0) ice_age();
    else log("Unknown ICE target: " + target);
}

function STOP() {
    stop();
}

function RESET() {
    reset();
}

function anything() {
    var args = arrayfromargs(arguments);
    log(
        "Unknown message: " +
        String(messagename || "") +
        (args.length ? " " + args.join(" ") : "")
    );
}
