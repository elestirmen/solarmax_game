/* Stellar Conquest - Web Audio API procedural sounds & music */
(function (global) {
    var ctx = null;
    var musicGain = null;
    var sfxGain = null;
    var musicOsc = null;
    var musicStarted = false;

    function getCtx() {
        if (!ctx) {
            try {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
                musicGain = ctx.createGain();
                sfxGain = ctx.createGain();
                musicGain.gain.value = 0.15;
                sfxGain.gain.value = 0.4;
                musicGain.connect(ctx.destination);
                sfxGain.connect(ctx.destination);
            } catch (e) { return null; }
        }
        return ctx;
    }

    function playTone(freq, duration, type, vol) {
        var c = getCtx();
        if (!c) return;
        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, c.currentTime + duration);
        gain.gain.setValueAtTime(vol || 0.15, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + duration);
    }

    global.AudioFX = {
        click: function () { playTone(600, 0.05, 'sine', 0.12); },
        select: function () { playTone(440, 0.06, 'triangle', 0.1); },
        send: function () { playTone(320, 0.08, 'square', 0.08); playTone(480, 0.1, 'sine', 0.06); },
        combat: function () { playTone(180, 0.12, 'sawtooth', 0.1); playTone(90, 0.15, 'square', 0.08); },
        capture: function () { playTone(523, 0.1, 'sine', 0.12); playTone(659, 0.12, 'sine', 0.1); playTone(784, 0.14, 'sine', 0.08); },
        upgrade: function () { playTone(880, 0.08, 'sine', 0.1); playTone(1100, 0.1, 'sine', 0.08); },
        victory: function () {
            var notes = [523, 659, 784, 1047];
            notes.forEach(function (f, i) { setTimeout(function () { playTone(f, 0.25, 'sine', 0.15); }, i * 120); });
        },
        defeat: function () {
            playTone(200, 0.3, 'sawtooth', 0.12);
            setTimeout(function () { playTone(150, 0.4, 'sawtooth', 0.1); }, 150);
        },
        achievement: function () {
            playTone(880, 0.08, 'sine', 0.12);
            setTimeout(function () { playTone(1320, 0.12, 'sine', 0.1); }, 80);
        },
        setSfxVolume: function (v) { if (sfxGain) sfxGain.gain.value = v; },
        setMusicVolume: function (v) { if (musicGain) musicGain.gain.value = v; },
        startMusic: function () {
            var c = getCtx();
            if (!c || musicStarted) return;
            musicStarted = true;
            musicOsc = c.createOscillator();
            var gain2 = c.createGain();
            musicOsc.type = 'sine';
            musicOsc.frequency.setValueAtTime(220, c.currentTime);
            gain2.gain.setValueAtTime(0.08, c.currentTime);
            musicOsc.connect(gain2);
            gain2.connect(musicGain);
            musicOsc.start(c.currentTime);
            var t = 0;
            function drift() {
                t += 0.15;
                if (musicOsc && musicOsc.frequency) {
                    musicOsc.frequency.setTargetAtTime(220 + Math.sin(t) * 20, c.currentTime, 0.5);
                }
                if (musicStarted) requestAnimationFrame(drift);
            }
            drift();
        },
        stopMusic: function () { musicStarted = false; if (musicOsc) try { musicOsc.stop(); } catch (e) {} musicOsc = null; },
    };
})(typeof window !== 'undefined' ? window : this);
