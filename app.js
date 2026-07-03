(function () {
    'use strict';

    // --- Config (all durations in seconds) ---
    const CONFIG = {
        normal: {
            defaultDurationSeconds: 1200,      // 20 minutes
            defaultBellIntervalSeconds: 120,   // 2 minutes
            minDurationSeconds: 60,            // 1 minute
            minBellIntervalSeconds: 0,
            stepSeconds: 60,                   // picker changes by 1 minute
        },
        test: {
            defaultDurationSeconds: 6,
            defaultBellIntervalSeconds: 3,
            minDurationSeconds: 1,
            minBellIntervalSeconds: 0,
            stepSeconds: 1,                    // picker changes by 1 second
        },
    };

    // --- DOM refs ---
    const setupView = document.getElementById('setup-view');
    const sessionView = document.getElementById('session-view');
    const durationInput = document.getElementById('duration');
    const bellIntervalInput = document.getElementById('bell-interval');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const countdownEl = document.getElementById('countdown');
    const testModeCheckbox = document.getElementById('test-mode');
    const durationLabel = document.querySelector('label[for="duration"]');
    const bellLabel = document.querySelector('label[for="bell-interval"]');

    // --- State ---
    let normalDurationSeconds = CONFIG.normal.defaultDurationSeconds;
    let normalBellIntervalSeconds = CONFIG.normal.defaultBellIntervalSeconds;
    let testDurationSeconds = CONFIG.test.defaultDurationSeconds;
    let testBellIntervalSeconds = CONFIG.test.defaultBellIntervalSeconds;

    let timerInterval = null;
    let remainingSeconds = 0;
    let bellIntervalSeconds = 0;
    let nextBellAt = 0; // remaining seconds at which next bell rings

    // --- Mode helpers ---
    function isTestMode() {
        return testModeCheckbox.checked;
    }

    function activeConfig() {
        return isTestMode() ? CONFIG.test : CONFIG.normal;
    }

    function syncInputsFromState() {
        const cfg = activeConfig();
        const durSec = isTestMode() ? testDurationSeconds : normalDurationSeconds;
        const bellSec = isTestMode() ? testBellIntervalSeconds : normalBellIntervalSeconds;
        durationInput.value = durSec / cfg.stepSeconds;
        bellIntervalInput.value = bellSec / cfg.stepSeconds;
    }

    function syncStateFromInputs() {
        const cfg = activeConfig();
        const durSec = parseInt(durationInput.value, 10) * cfg.stepSeconds;
        const bellSec = parseInt(bellIntervalInput.value, 10) * cfg.stepSeconds;
        if (isTestMode()) {
            testDurationSeconds = durSec;
            testBellIntervalSeconds = bellSec;
        } else {
            normalDurationSeconds = durSec;
            normalBellIntervalSeconds = bellSec;
        }
    }

    // --- Audio: Singing bowl via Tone.js ---
    // Singing bowls have inharmonic partials with long, staggered decays.
    const PARTIALS = [
        { ratio: 1.0,   gain: 0.6,  decay: 5.0 },
        { ratio: 2.71,  gain: 0.3,  decay: 3.5 },
        { ratio: 5.04,  gain: 0.15, decay: 2.5 },
        { ratio: 7.87,  gain: 0.08, decay: 1.8 },
        { ratio: 11.03, gain: 0.04, decay: 1.2 },
    ];
    const BASE_FREQ = 220; // A3 — warm bowl fundamental

    let bellSynths = null;

    function ensureBellSynths() {
        if (bellSynths) return;
        bellSynths = PARTIALS.map(function (p) {
            return new Tone.Synth({
                oscillator: { type: 'sine' },
                envelope: {
                    attack: 0.005,
                    decay: p.decay,
                    sustain: 0,
                    release: 0.3,
                },
            }).toDestination();
        });
    }

    function playBell() {
        ensureBellSynths();
        const now = Tone.now();
        PARTIALS.forEach(function (p, i) {
            bellSynths[i].volume.value = Tone.gainToDb(p.gain);
            bellSynths[i].triggerAttackRelease(BASE_FREQ * p.ratio, p.decay, now);
        });
    }

    // --- Timer logic ---
    function formatTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function tick() {
        remainingSeconds--;

        if (bellIntervalSeconds > 0 && remainingSeconds > 0 && remainingSeconds <= nextBellAt) {
            playBell();
            nextBellAt -= bellIntervalSeconds;
        }

        countdownEl.textContent = formatTime(remainingSeconds);

        if (remainingSeconds <= 0) {
            endSession(true);
        }
    }

    function startSession() {
        syncStateFromInputs();

        remainingSeconds = isTestMode() ? testDurationSeconds : normalDurationSeconds;
        bellIntervalSeconds = isTestMode() ? testBellIntervalSeconds : normalBellIntervalSeconds;
        nextBellAt = bellIntervalSeconds > 0 ? remainingSeconds - bellIntervalSeconds : -1;

        countdownEl.textContent = formatTime(remainingSeconds);
        setupView.hidden = true;
        sessionView.hidden = false;

        // Ensure Tone.js audio context is started (browsers require user gesture)
        Tone.start();

        timerInterval = setInterval(tick, 1000);
    }

    function endSession(completed) {
        clearInterval(timerInterval);
        timerInterval = null;

        if (completed) {
            playBell();
        }

        setupView.hidden = false;
        sessionView.hidden = true;
    }

    // --- Picker buttons ---
    document.querySelectorAll('.picker-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const target = document.getElementById(btn.dataset.target);
            const cfg = activeConfig();
            const delta = parseInt(btn.dataset.delta, 10);
            const isDuration = target.id === 'duration';
            const minSeconds = isDuration ? cfg.minDurationSeconds : cfg.minBellIntervalSeconds;
            const minDisplay = minSeconds / cfg.stepSeconds;

            let val = parseInt(target.value, 10) + delta;
            val = Math.max(minDisplay, val);
            target.value = val;
        });
    });

    // --- Test mode toggle ---
    testModeCheckbox.addEventListener('change', function () {
        // Save inputs to the mode we're LEAVING (opposite of current state)
        var leavingTest = !isTestMode();
        var cfg = leavingTest ? CONFIG.test : CONFIG.normal;
        var durSec = parseInt(durationInput.value, 10) * cfg.stepSeconds;
        var bellSec = parseInt(bellIntervalInput.value, 10) * cfg.stepSeconds;
        if (leavingTest) {
            testDurationSeconds = durSec;
            testBellIntervalSeconds = bellSec;
        } else {
            normalDurationSeconds = durSec;
            normalBellIntervalSeconds = bellSec;
        }

        // Update labels and load new mode's values
        var unit = isTestMode() ? 'seconds' : 'minutes';
        durationLabel.textContent = 'Duration (' + unit + ')';
        bellLabel.textContent = 'Bell every (' + unit + ')';
        syncInputsFromState();
    });

    // --- Init ---
    syncInputsFromState();

    // --- Event listeners ---
    startBtn.addEventListener('click', startSession);
    stopBtn.addEventListener('click', function () { endSession(false); });
})();
