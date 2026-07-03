(function () {
    'use strict';

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
    let timerInterval = null;
    let remainingSeconds = 0;
    let bellIntervalSeconds = 0;
    let nextBellAt = 0; // remaining seconds at which next bell rings
    let audioCtx = null;

    // --- Audio ---
    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playBell() {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // A soft sine-wave bell with gentle decay
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(528, now);
        osc.frequency.exponentialRampToValueAtTime(396, now + 1.5);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 2);
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
        const durationVal = parseInt(durationInput.value, 10) || 10;
        const bellVal = parseInt(bellIntervalInput.value, 10) || 0;
        const multiplier = testModeCheckbox.checked ? 1 : 60;

        remainingSeconds = durationVal * multiplier;
        bellIntervalSeconds = bellVal * multiplier;
        nextBellAt = bellIntervalSeconds > 0 ? remainingSeconds - bellIntervalSeconds : -1;

        countdownEl.textContent = formatTime(remainingSeconds);
        setupView.hidden = true;
        sessionView.hidden = false;

        // Ensure AudioContext is resumed (browsers require user gesture)
        if (audioCtx) audioCtx.resume();

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
            const delta = parseInt(btn.dataset.delta, 10);
            const min = parseInt(target.min, 10);
            const max = parseInt(target.max, 10);
            let val = parseInt(target.value, 10) + delta;
            val = Math.max(min, Math.min(max, val));
            target.value = val;
        });
    });

    // --- Test mode toggle ---
    testModeCheckbox.addEventListener('change', function () {
        const unit = testModeCheckbox.checked ? 'seconds' : 'minutes';
        durationLabel.textContent = 'Duration (' + unit + ')';
        bellLabel.textContent = 'Bell every (' + unit + ')';
    });

    // --- Event listeners ---
    startBtn.addEventListener('click', startSession);
    stopBtn.addEventListener('click', function () { endSession(false); });
})();
