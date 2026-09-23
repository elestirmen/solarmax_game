/* Stellar Conquest - Enhanced Web Audio SFX + adaptive music */
(function (global) {
    var ctx = null;
    var masterGain = null;
    var masterComp = null;
    var sfxBus = null;
    var musicBus = null;
    var reverb = null;
    var reverbGain = null;
    var noiseBuffer = null;
    var unlockBound = false;
    var lastCombatAt = 0;
    var combatAccentFlip = false;
    var lastWormholeTeleportAt = 0;
    var lastSolarFlareWarnAt = 0;
    var lastSolarFlareBlastAt = 0;
    var lastDeniedAt = 0;

    var musicDelay = null;
    var lastExplosionAt = 0;
    var lastCaptureAt = 0;

    // Generative score in D minor. Chords change every two bars; `intensity` (0..1,
    // driven by the game) decides which layers play, so a quiet build-up and a
    // desperate defence sound like different pieces without ever cutting.
    var music = {
        started: false,
        timer: null,
        bpm: 84,
        step: 0,
        bar: 0,
        intensity: 0.12,
        targetIntensity: 0.12,
        mood: 'menu',
        chord: 0,
        tense: false,
    };

    var MUSIC_ROOT = 38; // D2
    var PROGRESSIONS = {
        // i9 - VImaj7 - IIImaj7 - VII(add9): open, drifting, unresolved.
        calm: [[0, 3, 7, 10, 14], [-4, 0, 3, 7, 10], [3, 7, 10, 14], [-2, 2, 5, 9]],
        // i - iv9 - VI - V7: the leading tone pulls every four bars.
        tense: [[0, 3, 7, 10], [-7, -4, 0, 3, 7], [-4, 0, 3, 7], [-5, -1, 2, 5]],
    };

    function clamp(v, lo, hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function dbToGain(db) {
        return Math.pow(10, db / 20);
    }

    function midiToHz(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function makeImpulse(c, seconds, decay) {
        var length = Math.max(1, Math.floor(c.sampleRate * seconds));
        var buffer = c.createBuffer(2, length, c.sampleRate);
        for (var ch = 0; ch < 2; ch++) {
            var data = buffer.getChannelData(ch);
            for (var i = 0; i < length; i++) {
                var t = i / length;
                var env = Math.pow(1 - t, decay);
                data[i] = (Math.random() * 2 - 1) * env;
            }
        }
        return buffer;
    }

    function makeNoiseBuffer(c) {
        var buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        return buffer;
    }

    function setupUnlock(c) {
        if (unlockBound) return;
        unlockBound = true;
        var unlock = function () {
            if (c.state === 'suspended') {
                c.resume().catch(function () { });
            }
        };
        ['pointerdown', 'keydown', 'touchstart'].forEach(function (eventName) {
            window.addEventListener(eventName, unlock, { passive: true });
        });
    }

    function getCtx() {
        if (ctx) return ctx;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            return null;
        }

        masterGain = ctx.createGain();
        masterComp = ctx.createDynamicsCompressor();
        sfxBus = ctx.createGain();
        musicBus = ctx.createGain();
        reverb = ctx.createConvolver();
        reverbGain = ctx.createGain();

        masterGain.gain.value = 0.95;

        // Smooth out peaks from many concurrent sounds.
        masterComp.threshold.value = -18;
        masterComp.knee.value = 24;
        masterComp.ratio.value = 5;
        masterComp.attack.value = 0.003;
        masterComp.release.value = 0.22;

        sfxBus.gain.value = 0.85;
        musicBus.gain.value = 0.55;
        reverbGain.gain.value = 0.16;

        reverb.buffer = makeImpulse(ctx, 1.85, 2.4);

        sfxBus.connect(masterGain);
        musicBus.connect(masterGain);
        masterGain.connect(masterComp);
        masterComp.connect(ctx.destination);

        sfxBus.connect(reverb);
        musicBus.connect(reverb);
        reverb.connect(reverbGain);
        reverbGain.connect(masterGain);

        // Dotted-eighth echo for the arpeggio: the single effect that makes a sparse
        // line of notes sound like space instead of a metronome.
        musicDelay = ctx.createDelay(2);
        musicDelay.delayTime.value = (60 / music.bpm) * 0.75;
        var delayFeedback = ctx.createGain();
        delayFeedback.gain.value = 0.36;
        var delayTone = ctx.createBiquadFilter();
        delayTone.type = 'lowpass';
        delayTone.frequency.value = 2400;
        var delayOut = ctx.createGain();
        delayOut.gain.value = 0.55;
        musicDelay.connect(delayTone);
        delayTone.connect(delayFeedback);
        delayFeedback.connect(musicDelay);
        delayTone.connect(delayOut);
        delayOut.connect(musicBus);

        noiseBuffer = makeNoiseBuffer(ctx);
        setupUnlock(ctx);
        return ctx;
    }

    function envGain(gainParam, now, opt) {
        var a = Math.max(0.001, opt.attack || 0.005);
        var d = Math.max(0.001, opt.decay || 0.02);
        var s = Math.max(0.0001, opt.sustain || 0.001);
        var r = Math.max(0.001, opt.release || 0.05);
        var peak = Math.max(0.0001, opt.peak || 0.1);
        var hold = Math.max(0, Number(opt.hold) || 0);

        gainParam.cancelScheduledValues(now);
        gainParam.setValueAtTime(0.0001, now);
        gainParam.exponentialRampToValueAtTime(peak, now + a);
        gainParam.exponentialRampToValueAtTime(s, now + a + d);
        // Sustained sounds (pads, drones) hold their level before releasing; without a
        // hold an exponential release starts decaying the instant the attack ends.
        if (hold > 0) gainParam.setValueAtTime(s, now + a + d + hold);
        gainParam.exponentialRampToValueAtTime(0.0001, now + a + d + hold + r);
        return now + a + d + hold + r;
    }

    function createPanNode(c, pan) {
        if (c.createStereoPanner) {
            var p = c.createStereoPanner();
            p.pan.value = clamp(pan || 0, -1, 1);
            return p;
        }
        return null;
    }

    function playOsc(opt) {
        var c = getCtx();
        if (!c) return;
        var now = c.currentTime + (opt.delay || 0);

        var osc = c.createOscillator();
        var gain = c.createGain();
        var target = opt.target || sfxBus;

        osc.type = opt.type || 'sine';
        osc.frequency.setValueAtTime(Math.max(20, opt.freq || 440), now);
        if (typeof opt.detune === 'number') osc.detune.setValueAtTime(opt.detune, now);
        if (typeof opt.freqEnd === 'number') {
            var sweepTime = Math.max(0.005, opt.sweep || 0.08);
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.freqEnd), now + sweepTime);
        }

        var chainHead = osc;
        if (opt.filterType) {
            var filter = c.createBiquadFilter();
            filter.type = opt.filterType;
            filter.frequency.setValueAtTime(Math.max(20, opt.filterFreq || 1200), now);
            filter.Q.value = opt.filterQ || 0.0001;
            if (typeof opt.filterFreqEnd === 'number') {
                filter.frequency.exponentialRampToValueAtTime(Math.max(20, opt.filterFreqEnd), now + Math.max(0.01, opt.filterSweep || 0.1));
            }
            chainHead.connect(filter);
            chainHead = filter;
        }

        var panNode = createPanNode(c, opt.pan || 0);
        chainHead.connect(gain);
        if (panNode) {
            gain.connect(panNode);
            panNode.connect(target);
        } else {
            gain.connect(target);
        }

        if (opt.reverbSend) {
            var send = c.createGain();
            send.gain.value = clamp(opt.reverbSend, 0, 1);
            gain.connect(send);
            send.connect(reverb);
        }
        if (opt.delaySend && musicDelay) {
            var echo = c.createGain();
            echo.gain.value = clamp(opt.delaySend, 0, 1);
            gain.connect(echo);
            echo.connect(musicDelay);
        }

        var end = envGain(gain.gain, now, {
            attack: opt.attack,
            decay: opt.decay,
            sustain: opt.sustain,
            hold: opt.hold,
            release: opt.release,
            peak: opt.gain,
        });

        osc.start(now);
        osc.stop(end + 0.02);
    }

    // Callers may pass { pan, gain } describing where on screen an event happened;
    // folded into a sound's own pan and level here so every cue can be positional.
    function spatial(o) {
        o = o && typeof o === 'object' ? o : {};
        return {
            pan: clamp(Number(o.pan) || 0, -1, 1),
            gain: clamp(o.gain === undefined ? 1 : Number(o.gain), 0, 1.5),
        };
    }

    function playNoise(opt) {
        var c = getCtx();
        if (!c || !noiseBuffer) return;
        var now = c.currentTime + (opt.delay || 0);

        var src = c.createBufferSource();
        src.buffer = noiseBuffer;
        src.loop = !!opt.loop;

        var gain = c.createGain();
        var target = opt.target || sfxBus;

        var filter = c.createBiquadFilter();
        filter.type = opt.filterType || 'bandpass';
        filter.frequency.setValueAtTime(Math.max(20, opt.filterFreq || 1200), now);
        filter.Q.value = typeof opt.filterQ === 'number' ? opt.filterQ : 0.8;
        if (typeof opt.filterFreqEnd === 'number') {
            filter.frequency.exponentialRampToValueAtTime(Math.max(20, opt.filterFreqEnd), now + Math.max(0.01, opt.filterSweep || 0.12));
        }

        var panNode = createPanNode(c, opt.pan || 0);
        src.connect(filter);
        filter.connect(gain);

        if (panNode) {
            gain.connect(panNode);
            panNode.connect(target);
        } else {
            gain.connect(target);
        }

        if (opt.reverbSend) {
            var send = c.createGain();
            send.gain.value = clamp(opt.reverbSend, 0, 1);
            gain.connect(send);
            send.connect(reverb);
        }

        var end = envGain(gain.gain, now, {
            attack: opt.attack,
            decay: opt.decay,
            sustain: opt.sustain,
            hold: opt.hold,
            release: opt.release,
            peak: opt.gain,
        });

        src.start(now);
        src.stop(end + 0.03);
    }

    var lastUiClickAt = 0;
    function uiClick() {
        var c = getCtx();
        if (!c) return;
        if (c.currentTime - lastUiClickAt < 0.045) return;
        lastUiClickAt = c.currentTime;
        playOsc({
            type: 'triangle',
            freq: 1450,
            freqEnd: 920,
            sweep: 0.035,
            gain: 0.065,
            attack: 0.001,
            decay: 0.01,
            sustain: 0.02,
            release: 0.025,
            filterType: 'highpass',
            filterFreq: 600,
            pan: rand(-0.05, 0.05),
        });
    }

    function selectSound() {
        playOsc({
            type: 'triangle',
            freq: 560,
            freqEnd: 720,
            sweep: 0.04,
            gain: 0.08,
            attack: 0.002,
            decay: 0.03,
            sustain: 0.035,
            release: 0.06,
            filterType: 'bandpass',
            filterFreq: 1700,
            filterQ: 2.1,
        });
        playOsc({
            type: 'sine',
            freq: 840,
            gain: 0.035,
            attack: 0.002,
            decay: 0.02,
            sustain: 0.01,
            release: 0.07,
            delay: 0.03,
            reverbSend: 0.18,
        });
    }

    function solarFlareWarningSound() {
        var c = getCtx();
        if (!c) return;
        var now = c.currentTime;
        if (now - lastSolarFlareWarnAt < 1.2) return;
        lastSolarFlareWarnAt = now;

        playNoise({
            filterType: 'bandpass',
            filterFreq: 280,
            filterFreqEnd: 720,
            filterSweep: 0.55,
            filterQ: 2.2,
            gain: 0.09,
            attack: 0.04,
            decay: 0.15,
            sustain: 0.12,
            release: 0.35,
            reverbSend: 0.32,
        });
        for (var i = 0; i < 4; i++) {
            playOsc({
                type: 'sawtooth',
                freq: 110 + i * 55,
                freqEnd: 165 + i * 80,
                sweep: 0.35 + i * 0.06,
                gain: 0.04 - i * 0.006,
                attack: 0.02 + i * 0.02,
                decay: 0.08,
                sustain: 0.05,
                release: 0.45,
                delay: i * 0.07,
                filterType: 'lowpass',
                filterFreq: 520 + i * 180,
                filterFreqEnd: 1100,
                filterSweep: 0.2,
                reverbSend: 0.24,
            });
        }
        playOsc({
            type: 'square',
            freq: 880,
            freqEnd: 1320,
            sweep: 0.08,
            gain: 0.018,
            attack: 0.001,
            decay: 0.02,
            sustain: 0.01,
            release: 0.04,
            delay: 0.15,
            filterType: 'bandpass',
            filterFreq: 2200,
            filterQ: 8,
        });
    }

    function solarFlareBlastSound() {
        var c = getCtx();
        if (!c) return;
        var now = c.currentTime;
        if (now - lastSolarFlareBlastAt < 0.35) return;
        lastSolarFlareBlastAt = now;

        playNoise({
            filterType: 'lowpass',
            filterFreq: 2400,
            filterFreqEnd: 120,
            filterSweep: 0.5,
            gain: 0.2,
            attack: 0.001,
            decay: 0.07,
            sustain: 0.06,
            release: 0.55,
            reverbSend: 0.38,
        });
        playOsc({
            type: 'sawtooth',
            freq: 58,
            freqEnd: 22,
            sweep: 0.65,
            gain: 0.11,
            attack: 0.002,
            decay: 0.12,
            sustain: 0.08,
            release: 0.9,
            filterType: 'lowpass',
            filterFreq: 900,
            filterFreqEnd: 80,
            filterSweep: 0.5,
            reverbSend: 0.28,
        });
        for (var j = 0; j < 3; j++) {
            playOsc({
                type: 'sine',
                freq: 520 + j * 90,
                gain: 0.035 - j * 0.007,
                attack: 0.001,
                decay: 0.03,
                sustain: 0.02,
                release: 0.25,
                delay: 0.02 + j * 0.03,
                reverbSend: 0.35,
            });
        }
    }

    function wormholeTeleportSound() {
        var c = getCtx();
        if (!c) return;
        var now = c.currentTime;
        if (now - lastWormholeTeleportAt < 0.16) return;
        lastWormholeTeleportAt = now;

        var pan = rand(-0.42, 0.42);
        var panOpp = -pan;

        playNoise({
            filterType: 'highpass',
            filterFreq: 6200,
            filterFreqEnd: 900,
            filterSweep: 0.045,
            filterQ: 0.65,
            gain: 0.07,
            attack: 0.001,
            decay: 0.018,
            sustain: 0.01,
            release: 0.08,
            pan: panOpp,
            reverbSend: 0.55,
        });

        playNoise({
            filterType: 'bandpass',
            filterFreq: 8000,
            filterFreqEnd: 320,
            filterSweep: 0.38,
            filterQ: 1.1,
            gain: 0.14,
            attack: 0.001,
            decay: 0.028,
            sustain: 0.1,
            release: 0.52,
            pan: pan,
            reverbSend: 0.48,
        });
        playNoise({
            filterType: 'lowpass',
            filterFreq: 3800,
            filterFreqEnd: 70,
            filterSweep: 0.62,
            filterQ: 0.55,
            gain: 0.118,
            attack: 0.002,
            decay: 0.06,
            sustain: 0.12,
            release: 0.62,
            pan: panOpp * 0.85,
            reverbSend: 0.52,
        });

        playOsc({
            type: 'sine',
            freq: 280,
            freqEnd: 24,
            sweep: 0.48,
            gain: 0.14,
            attack: 0.002,
            decay: 0.07,
            sustain: 0.11,
            release: 0.58,
            pan: pan * 0.35,
            filterType: 'lowpass',
            filterFreq: 900,
            filterFreqEnd: 60,
            filterSweep: 0.5,
            filterQ: 0.9,
            reverbSend: 0.32,
        });
        playOsc({
            type: 'sine',
            freq: 62,
            freqEnd: 28,
            sweep: 0.55,
            gain: 0.11,
            attack: 0.004,
            decay: 0.08,
            sustain: 0.14,
            release: 0.75,
            pan: panOpp * 0.25,
            reverbSend: 0.38,
        });
        playOsc({
            type: 'triangle',
            freq: 55,
            gain: 0.065,
            attack: 0.008,
            decay: 0.04,
            sustain: 0.05,
            release: 0.45,
            delay: 0.12,
            pan: pan * 0.5,
            reverbSend: 0.42,
        });

        playOsc({
            type: 'sawtooth',
            freq: 410,
            freqEnd: 48,
            sweep: 0.35,
            gain: 0.055,
            attack: 0.001,
            decay: 0.045,
            sustain: 0.03,
            release: 0.38,
            delay: 0.018,
            pan: pan * 0.4,
            filterType: 'lowpass',
            filterFreq: 2200,
            filterFreqEnd: 140,
            filterSweep: 0.34,
            filterQ: 2.2,
            reverbSend: 0.42,
        });

        playOsc({
            type: 'triangle',
            freq: 1200,
            freqEnd: 80,
            sweep: 0.26,
            gain: 0.072,
            attack: 0.001,
            decay: 0.028,
            sustain: 0.025,
            release: 0.36,
            delay: 0.014,
            pan: panOpp * 0.45,
            filterType: 'bandpass',
            filterFreq: 3400,
            filterFreqEnd: 280,
            filterSweep: 0.28,
            filterQ: 5,
            reverbSend: 0.55,
        });

        playOsc({
            type: 'square',
            freq: 1900,
            freqEnd: 220,
            sweep: 0.2,
            gain: 0.022,
            attack: 0.001,
            decay: 0.02,
            sustain: 0.012,
            release: 0.22,
            delay: 0.022,
            pan: rand(-0.35, 0.35),
            filterType: 'bandpass',
            filterFreq: 2600,
            filterFreqEnd: 500,
            filterSweep: 0.2,
            filterQ: 3.5,
            reverbSend: 0.5,
        });

        var shFreqs = [2112, 2640, 3168, 4224];
        for (var si = 0; si < shFreqs.length; si++) {
            playOsc({
                type: si % 2 ? 'triangle' : 'sine',
                freq: shFreqs[si],
                detune: rand(-9, 9),
                gain: 0.026 - si * 0.004,
                attack: 0.001,
                decay: 0.035 + si * 0.01,
                sustain: 0.015,
                release: 0.22 + si * 0.04,
                delay: si * 0.012,
                pan: (si % 2 ? pan : panOpp) * (0.35 + si * 0.06),
                reverbSend: 0.58,
                filterType: 'highpass',
                filterFreq: 700,
            });
        }
    }

    function sendSound(o) {
        var sp = spatial(o);
        var pan = clamp(sp.pan + rand(-0.12, 0.12), -1, 1);
        playOsc({
            type: 'sawtooth',
            freq: 980,
            freqEnd: 170,
            sweep: 0.17,
            gain: 0.12,
            attack: 0.001,
            decay: 0.02,
            sustain: 0.025,
            release: 0.12,
            filterType: 'lowpass',
            filterFreq: 2800,
            filterFreqEnd: 520,
            filterSweep: 0.16,
            filterQ: 3.8,
            pan: pan,
            reverbSend: 0.05,
        });
        playOsc({
            type: 'square',
            freq: 520,
            freqEnd: 280,
            sweep: 0.11,
            gain: 0.045,
            attack: 0.001,
            decay: 0.015,
            sustain: 0.01,
            release: 0.085,
            pan: pan * 0.8,
        });
        playNoise({
            filterType: 'bandpass',
            filterFreq: 2200,
            filterFreqEnd: 540,
            filterSweep: 0.13,
            filterQ: 1.4,
            gain: 0.032,
            attack: 0.001,
            decay: 0.015,
            sustain: 0.01,
            release: 0.06,
            pan: pan,
        });
    }

    function combatSound(o) {
        var c = getCtx();
        if (!c) return;
        var now = c.currentTime;
        var sp = spatial(o);
        var weight = clamp(o && o.intensity !== undefined ? Number(o.intensity) : 0.7, 0.2, 1.4);

        // Combat can happen in bursts; clamp trigger rate to avoid harsh spam.
        if (now - lastCombatAt < 0.065) return;
        lastCombatAt = now;

        var pan = clamp(sp.pan + rand(-0.12, 0.12), -1, 1);
        var level = sp.gain * (0.65 + weight * 0.4);
        var accent = combatAccentFlip;
        combatAccentFlip = !combatAccentFlip;

        // Low-mid body thump.
        playOsc({
            type: 'sine',
            freq: accent ? 118 : 104,
            freqEnd: 62,
            sweep: 0.12,
            gain: 0.095 * level,
            attack: 0.001,
            decay: 0.02,
            sustain: 0.03,
            release: 0.14,
            pan: pan * 0.5,
        });

        // Short texture crack without piercing highs.
        playNoise({
            filterType: accent ? 'bandpass' : 'lowpass',
            filterFreq: accent ? 980 : 760,
            filterFreqEnd: accent ? 480 : 220,
            filterSweep: 0.1,
            filterQ: accent ? 1.1 : 0.65,
            gain: (accent ? 0.085 : 0.07) * level,
            attack: 0.001,
            decay: 0.015,
            sustain: 0.01,
            release: 0.09,
            pan: pan,
            reverbSend: 0.06,
        });

        // Small transient keeps impact readable on low speaker volume.
        playOsc({
            type: 'triangle',
            freq: accent ? 210 : 170,
            freqEnd: 120,
            sweep: 0.08,
            gain: 0.04 * level,
            attack: 0.001,
            decay: 0.012,
            sustain: 0.008,
            release: 0.07,
            delay: 0.004,
            filterType: 'lowpass',
            filterFreq: 900,
            pan: -pan * 0.15,
        });
    }

    // Taking a world: a rising major arpeggio over a low swell, panned to where it
    // happened. The loudest positive cue in the game, rate-limited so a chain of
    // captures rolls instead of stacking.
    function captureSound(o) {
        var c = getCtx();
        if (!c) return;
        var sp = spatial(o);
        var now = c.currentTime;
        var soft = now - lastCaptureAt < 0.25;
        lastCaptureAt = now;
        var level = sp.gain * (soft ? 0.6 : 1);
        var notes = [587.33, 739.99, 880, 1174.66];
        for (var i = 0; i < notes.length; i++) {
            playOsc({
                type: i % 2 ? 'triangle' : 'sine',
                freq: notes[i],
                gain: (0.075 - i * 0.009) * level,
                attack: 0.003,
                decay: 0.05,
                sustain: 0.035,
                release: 0.34,
                delay: i * 0.05,
                pan: clamp(sp.pan + (i - 1.5) * 0.08, -1, 1),
                reverbSend: 0.28,
            });
        }
        playOsc({
            type: 'sine',
            freq: 146.83,
            freqEnd: 220,
            sweep: 0.3,
            gain: 0.07 * level,
            attack: 0.01,
            decay: 0.12,
            sustain: 0.04,
            release: 0.5,
            pan: sp.pan * 0.5,
            filterType: 'lowpass',
            filterFreq: 700,
            reverbSend: 0.2,
        });
        playOsc({
            type: 'triangle',
            freq: 1760,
            gain: 0.022 * level,
            attack: 0.002,
            decay: 0.03,
            sustain: 0.01,
            release: 0.6,
            delay: 0.2,
            pan: sp.pan,
            reverbSend: 0.45,
        });
    }

    // Losing a world must be unmistakable even with the camera elsewhere: a low
    // falling minor second over a dull impact.
    function planetLostSound(o) {
        var sp = spatial(o);
        var level = sp.gain;
        playOsc({
            type: 'sine',
            freq: 120,
            freqEnd: 48,
            sweep: 0.4,
            gain: 0.13 * level,
            attack: 0.002,
            decay: 0.08,
            sustain: 0.05,
            release: 0.5,
            pan: sp.pan * 0.4,
        });
        var tones = [311.13, 293.66];
        for (var i = 0; i < tones.length; i++) {
            playOsc({
                type: 'triangle',
                freq: tones[i],
                freqEnd: tones[i] * 0.94,
                sweep: 0.3,
                gain: 0.06 * level,
                attack: 0.004,
                decay: 0.08,
                sustain: 0.04,
                release: 0.42,
                delay: 0.06 + i * 0.16,
                pan: sp.pan,
                filterType: 'lowpass',
                filterFreq: 1500,
                reverbSend: 0.3,
            });
        }
        playNoise({
            filterType: 'lowpass',
            filterFreq: 900,
            filterFreqEnd: 160,
            filterSweep: 0.5,
            gain: 0.04 * level,
            attack: 0.004,
            decay: 0.06,
            sustain: 0.02,
            release: 0.45,
            pan: sp.pan,
            reverbSend: 0.2,
        });
    }

    // Somebody else's capture: a muted chime, so the map's tempo is audible without
    // competing with the player's own events.
    function distantCaptureSound(o) {
        var c = getCtx();
        if (!c) return;
        var now = c.currentTime;
        if (now - lastCaptureAt < 0.18) return;
        lastCaptureAt = now;
        var sp = spatial(o);
        playOsc({
            type: 'sine',
            freq: 523.25,
            gain: 0.03 * sp.gain,
            attack: 0.004,
            decay: 0.05,
            sustain: 0.02,
            release: 0.3,
            pan: sp.pan,
            filterType: 'lowpass',
            filterFreq: 1800,
            reverbSend: 0.35,
        });
        playOsc({
            type: 'sine',
            freq: 392,
            gain: 0.022 * sp.gain,
            attack: 0.004,
            decay: 0.05,
            sustain: 0.02,
            release: 0.3,
            delay: 0.07,
            pan: sp.pan,
            filterType: 'lowpass',
            filterFreq: 1600,
            reverbSend: 0.35,
        });
    }

    function explosionSound(o) {
        var c = getCtx();
        if (!c) return;
        var now = c.currentTime;
        if (now - lastExplosionAt < 0.09) return;
        lastExplosionAt = now;
        var sp = spatial(o);
        var size = clamp(o && o.size !== undefined ? Number(o.size) : 0.5, 0.1, 1);
        playOsc({
            type: 'sine',
            freq: 90 + (1 - size) * 60,
            freqEnd: 34,
            sweep: 0.25 + size * 0.2,
            gain: (0.06 + size * 0.07) * sp.gain,
            attack: 0.001,
            decay: 0.05,
            sustain: 0.03,
            release: 0.22 + size * 0.3,
            pan: sp.pan * 0.6,
        });
        playNoise({
            filterType: 'lowpass',
            filterFreq: 1400 + size * 800,
            filterFreqEnd: 200,
            filterSweep: 0.3 + size * 0.2,
            filterQ: 0.7,
            gain: (0.05 + size * 0.05) * sp.gain,
            attack: 0.001,
            decay: 0.04,
            sustain: 0.02,
            release: 0.25 + size * 0.35,
            pan: sp.pan,
            reverbSend: 0.18,
        });
    }

    function upgradeStartSound() {
        playOsc({
            type: 'sine',
            freq: 140,
            freqEnd: 360,
            sweep: 0.42,
            gain: 0.05,
            attack: 0.008,
            decay: 0.09,
            sustain: 0.075,
            release: 0.3,
            filterType: 'lowpass',
            filterFreq: 680,
            filterFreqEnd: 1800,
            filterSweep: 0.38,
            reverbSend: 0.22,
        });
        playOsc({
            type: 'triangle',
            freq: 220,
            freqEnd: 440,
            sweep: 0.33,
            gain: 0.032,
            attack: 0.004,
            decay: 0.06,
            sustain: 0.05,
            release: 0.24,
            delay: 0.018,
            filterType: 'bandpass',
            filterFreq: 920,
            filterFreqEnd: 1900,
            filterSweep: 0.28,
            reverbSend: 0.18,
        });
        playOsc({
            type: 'sawtooth',
            freq: 760,
            freqEnd: 1160,
            sweep: 0.14,
            gain: 0.014,
            attack: 0.012,
            decay: 0.035,
            sustain: 0.015,
            release: 0.2,
            delay: 0.09,
            filterType: 'highpass',
            filterFreq: 2500,
            reverbSend: 0.3,
        });
        playNoise({
            filterType: 'bandpass',
            filterFreq: 850,
            filterFreqEnd: 2400,
            filterSweep: 0.34,
            filterQ: 1.4,
            gain: 0.014,
            attack: 0.002,
            decay: 0.08,
            sustain: 0.035,
            release: 0.18,
            delay: 0.01,
            reverbSend: 0.22,
        });
    }

    function upgradeCompleteSound() {
        playOsc({
            type: 'sine',
            freq: 128,
            freqEnd: 84,
            sweep: 0.11,
            gain: 0.06,
            attack: 0.002,
            decay: 0.04,
            sustain: 0.03,
            release: 0.26,
            filterType: 'lowpass',
            filterFreq: 260,
            reverbSend: 0.16,
        });
        playOsc({
            type: 'sawtooth',
            freq: 261.63,
            freqEnd: 523.25,
            sweep: 0.18,
            gain: 0.075,
            attack: 0.002,
            decay: 0.055,
            sustain: 0.06,
            release: 0.28,
            filterType: 'bandpass',
            filterFreq: 1500,
            filterFreqEnd: 2200,
            filterSweep: 0.16,
            filterQ: 1.7,
            reverbSend: 0.22,
        });
        playOsc({
            type: 'triangle',
            freq: 392,
            freqEnd: 783.99,
            sweep: 0.19,
            gain: 0.052,
            attack: 0.003,
            decay: 0.05,
            sustain: 0.045,
            release: 0.24,
            delay: 0.015,
            reverbSend: 0.28,
        });
        playOsc({
            type: 'sine',
            freq: 523.25,
            freqEnd: 1046.5,
            sweep: 0.15,
            gain: 0.03,
            attack: 0.001,
            decay: 0.035,
            sustain: 0.03,
            release: 0.3,
            delay: 0.045,
            filterType: 'highpass',
            filterFreq: 1800,
            reverbSend: 0.34,
        });
        playNoise({
            filterType: 'highpass',
            filterFreq: 2600,
            filterFreqEnd: 5200,
            filterSweep: 0.1,
            gain: 0.012,
            attack: 0.001,
            decay: 0.03,
            sustain: 0.02,
            release: 0.16,
            delay: 0.03,
            reverbSend: 0.24,
        });
    }

    function upgradeSound() {
        upgradeCompleteSound();
    }

    function achievementSound() {
        playOsc({
            type: 'sine',
            freq: 880,
            freqEnd: 1320,
            sweep: 0.08,
            gain: 0.095,
            attack: 0.002,
            decay: 0.03,
            sustain: 0.04,
            release: 0.2,
            reverbSend: 0.22,
        });
        playOsc({
            type: 'triangle',
            freq: 1320,
            gain: 0.055,
            attack: 0.001,
            decay: 0.03,
            sustain: 0.01,
            release: 0.16,
            delay: 0.06,
            reverbSend: 0.22,
        });
        playNoise({
            filterType: 'highpass',
            filterFreq: 3600,
            gain: 0.016,
            attack: 0.001,
            decay: 0.018,
            sustain: 0.004,
            release: 0.1,
            delay: 0.05,
            reverbSend: 0.2,
        });
    }

    // The three cues below are intentionally built from sine/triangle
    // oscillators with gentle low-pass filtering only — no white noise and
    // no square/sawtooth — so they stay clean and cannot hiss or buzz.

    function strategicPulseSound() {
        // Soft rising "power online" chime for a strategic pulse activating.
        var pulseNotes = [466.16, 622.25, 932.33];
        for (var i = 0; i < pulseNotes.length; i++) {
            playOsc({
                target: sfxBus,
                type: i % 2 ? 'sine' : 'triangle',
                freq: pulseNotes[i],
                gain: 0.05 - i * 0.008,
                attack: 0.004,
                decay: 0.06,
                sustain: 0.035,
                release: 0.34,
                delay: i * 0.075,
                reverbSend: 0.26,
            });
        }
        playOsc({
            target: sfxBus,
            type: 'sine',
            freq: 155.56,
            freqEnd: 233.08,
            sweep: 0.26,
            gain: 0.038,
            attack: 0.012,
            decay: 0.08,
            sustain: 0.03,
            release: 0.36,
            filterType: 'lowpass',
            filterFreq: 520,
            reverbSend: 0.14,
        });
    }

    function dominanceSound() {
        // Warm two-note lift for crossing the map-dominance threshold.
        var domNotes = [349.23, 523.25];
        for (var i = 0; i < domNotes.length; i++) {
            playOsc({
                target: sfxBus,
                type: 'triangle',
                freq: domNotes[i],
                gain: 0.058 - i * 0.01,
                attack: 0.004,
                decay: 0.07,
                sustain: 0.045,
                release: 0.3,
                delay: i * 0.1,
                reverbSend: 0.24,
            });
        }
        playOsc({
            target: sfxBus,
            type: 'sine',
            freq: 698.46,
            gain: 0.026,
            attack: 0.006,
            decay: 0.05,
            sustain: 0.03,
            release: 0.28,
            delay: 0.16,
            reverbSend: 0.3,
        });
    }

    function deniedSound() {
        // Soft, low descending "no" for a rejected order — two muffled sine
        // blips. Rate-limited so a quick double-click cannot stack it.
        var c = getCtx();
        if (!c) return;
        var now = c.currentTime;
        if (now - lastDeniedAt < 0.14) return;
        lastDeniedAt = now;
        var deniedNotes = [233.08, 174.61];
        for (var i = 0; i < deniedNotes.length; i++) {
            playOsc({
                target: sfxBus,
                type: 'sine',
                freq: deniedNotes[i],
                gain: 0.05,
                attack: 0.004,
                decay: 0.04,
                sustain: 0.025,
                release: 0.1,
                delay: i * 0.085,
                filterType: 'lowpass',
                filterFreq: 600,
            });
        }
    }

    function victorySound() {
        var seq = [
            { n: 392, d: 0.00 },
            { n: 494, d: 0.10 },
            { n: 587, d: 0.20 },
            { n: 784, d: 0.30 },
            { n: 988, d: 0.42 },
        ];
        seq.forEach(function (s, idx) {
            playOsc({
                type: idx < 3 ? 'triangle' : 'sine',
                freq: s.n,
                gain: 0.1 - idx * 0.01,
                attack: 0.002,
                decay: 0.045,
                sustain: 0.04,
                release: 0.24,
                delay: s.d,
                reverbSend: 0.28,
            });
        });
        playOsc({
            type: 'sawtooth',
            freq: 196,
            gain: 0.05,
            attack: 0.01,
            decay: 0.08,
            sustain: 0.03,
            release: 0.5,
            delay: 0.38,
            filterType: 'lowpass',
            filterFreq: 900,
            reverbSend: 0.35,
        });
    }

    function defeatSound() {
        var notes = [220, 196, 174, 146, 123];
        for (var i = 0; i < notes.length; i++) {
            playOsc({
                type: 'sawtooth',
                freq: notes[i],
                gain: 0.07 - i * 0.008,
                attack: 0.002,
                decay: 0.04,
                sustain: 0.04,
                release: 0.26,
                delay: i * 0.08,
                filterType: 'lowpass',
                filterFreq: 1000,
                filterFreqEnd: 260,
                filterSweep: 0.2,
                reverbSend: 0.2,
            });
        }
        playNoise({
            filterType: 'lowpass',
            filterFreq: 520,
            filterFreqEnd: 80,
            filterSweep: 0.55,
            gain: 0.14,
            attack: 0.001,
            decay: 0.06,
            sustain: 0.05,
            release: 0.5,
            delay: 0.1,
            reverbSend: 0.28,
        });
    }

    function voiceInRange(tone, low, high) {
        var n = MUSIC_ROOT + tone;
        while (n < low) n += 12;
        while (n > high) n -= 12;
        return n;
    }

    function currentChord() {
        var set = music.tense ? PROGRESSIONS.tense : PROGRESSIONS.calm;
        return set[music.chord % set.length];
    }

    // A pad chord: two detuned saws per voice through a lowpass that slowly opens, so
    // each chord blooms instead of switching on.
    // Root-position voicing stacked upward from the root: no semitone clusters in the
    // low register, where they turn to mud.
    function padVoicing(chord) {
        var voices = [voiceInRange(chord[0], 48, 59)];
        for (var i = 1; i < chord.length && voices.length < 4; i++) {
            var n = MUSIC_ROOT + chord[i];
            while (n <= voices[voices.length - 1]) n += 12;
            while (n - 12 > voices[voices.length - 1]) n -= 12;
            voices.push(n);
        }
        return voices;
    }

    function schedulePad(chord, when, duration, level) {
        var voices = padVoicing(chord);
        for (var v = 0; v < voices.length; v++) {
            for (var d = -1; d <= 1; d += 2) {
                playOsc({
                    target: musicBus,
                    type: 'sawtooth',
                    freq: midiToHz(voices[v]),
                    detune: d * 7,
                    gain: 0.011 * level,
                    attack: 1.4,
                    decay: 0.8,
                    sustain: 0.0085 * level,
                    hold: Math.max(0.5, duration * 0.45),
                    release: duration * 0.55,
                    delay: when - ctx.currentTime,
                    pan: -0.45 + v * 0.3 + d * 0.08,
                    filterType: 'lowpass',
                    filterFreq: 420,
                    filterFreqEnd: 900 + music.intensity * 900,
                    filterSweep: duration * 0.55,
                    filterQ: 0.6,
                    reverbSend: 0.4,
                });
            }
        }
    }

    function scheduleBass(tone, when, length, gain) {
        var note = voiceInRange(tone, 33, 45);
        playOsc({
            target: musicBus,
            type: 'sine',
            freq: midiToHz(note),
            gain: gain,
            attack: 0.02,
            decay: 0.2,
            sustain: gain * 0.6,
            hold: length * 0.5,
            release: length * 0.5,
            delay: when - ctx.currentTime,
            filterType: 'lowpass',
            filterFreq: 320,
        });
        playOsc({
            target: musicBus,
            type: 'triangle',
            freq: midiToHz(note + 12),
            gain: gain * 0.28,
            attack: 0.01,
            decay: 0.15,
            sustain: gain * 0.1,
            release: length * 0.6,
            delay: when - ctx.currentTime,
            filterType: 'lowpass',
            filterFreq: 700,
        });
    }

    function scheduleMusicStep(stepIndex, when) {
        // Glide toward the requested intensity: a battle swells the score over a few
        // seconds rather than slamming it on.
        music.intensity += (music.targetIntensity - music.intensity) * 0.04;
        var I = music.mood === 'menu' ? 0.1 : music.intensity;
        var stepDur = 60 / music.bpm / 4;
        var barInPhrase = music.bar % 2;

        if (stepIndex === 0 && barInPhrase === 0) {
            // Harmony may only change mode at a phrase boundary, never mid-chord.
            music.tense = music.mood !== 'menu' && (music.tense ? I > 0.42 : I > 0.55);
            music.chord++;
            var chord = currentChord();
            var phrase = stepDur * 32;
            schedulePad(chord, when, phrase * 1.15, 0.9 + I * 0.35);
            scheduleBass(chord[0], when, phrase * 0.9, 0.05 + I * 0.03);
        }
        var chordNow = currentChord();

        // Bells: rare, high, lots of reverb. The sound of empty space.
        if (stepIndex === 0 && Math.random() < (music.mood === 'menu' ? 0.35 : 0.22 * (1 - I))) {
            var bellTone = voiceInRange(chordNow[Math.floor(Math.random() * chordNow.length)], 74, 90);
            playOsc({
                target: musicBus,
                type: 'sine',
                freq: midiToHz(bellTone),
                gain: 0.022,
                attack: 0.003,
                decay: 0.2,
                sustain: 0.006,
                release: 2.6,
                delay: when - ctx.currentTime + stepDur * Math.floor(Math.random() * 8),
                pan: rand(-0.6, 0.6),
                reverbSend: 0.7,
                delaySend: 0.3,
            });
        }

        // Arpeggio: chord tones on eighths, denser and brighter as intensity rises.
        var arpChance = stepIndex % 2 === 0 ? 0.28 + I * 0.62 : Math.max(0, I - 0.55) * 1.4;
        if (Math.random() < arpChance) {
            var pattern = [0, 2, 1, 3, 2, 1, 3, 0];
            var arpIx = pattern[(stepIndex >> 1) % pattern.length] % chordNow.length;
            var arpNote = voiceInRange(chordNow[arpIx], 62, 79) + (Math.random() < 0.18 ? 12 : 0);
            playOsc({
                target: musicBus,
                type: I > 0.5 ? 'triangle' : 'sine',
                freq: midiToHz(arpNote),
                gain: 0.02 + I * 0.012,
                attack: 0.003,
                decay: 0.06,
                sustain: 0.006,
                release: 0.28,
                delay: when - ctx.currentTime,
                pan: rand(-0.35, 0.35),
                filterType: 'lowpass',
                filterFreq: 1800 + I * 2200,
                reverbSend: 0.25,
                delaySend: 0.42,
            });
        }

        // Pulse: an eighth-note bass ostinato once the map heats up.
        if (I > 0.34 && stepIndex % 2 === 0) {
            var pulseGain = (I - 0.34) * 0.07;
            playOsc({
                target: musicBus,
                type: 'triangle',
                freq: midiToHz(voiceInRange(chordNow[0], 38, 49)),
                gain: pulseGain * (stepIndex % 4 === 0 ? 1 : 0.65),
                attack: 0.004,
                decay: 0.05,
                sustain: pulseGain * 0.2,
                release: 0.14,
                delay: when - ctx.currentTime,
                filterType: 'lowpass',
                filterFreq: 420 + I * 500,
                filterQ: 2,
            });
        }

        // Drums only when there is a fight to underscore.
        if (I > 0.46 && (stepIndex === 0 || stepIndex === 8 || (I > 0.78 && stepIndex === 11))) {
            playOsc({
                target: musicBus,
                type: 'sine',
                freq: 92,
                freqEnd: 40,
                sweep: 0.12,
                gain: 0.05 + (I - 0.46) * 0.12,
                attack: 0.001,
                decay: 0.04,
                sustain: 0.02,
                release: 0.12,
                delay: when - ctx.currentTime,
            });
        }
        if (I > 0.62 && (stepIndex === 4 || stepIndex === 12)) {
            // Low tom rather than a snare: weight without the hiss of noise.
            playOsc({
                target: musicBus,
                type: 'sine',
                freq: 160,
                freqEnd: 96,
                sweep: 0.14,
                gain: (I - 0.62) * 0.1,
                attack: 0.001,
                decay: 0.05,
                sustain: 0.02,
                release: 0.16,
                delay: when - ctx.currentTime,
                reverbSend: 0.2,
            });
        }

        // Riser into the next phrase when things are dire.
        if (I > 0.72 && barInPhrase === 1 && stepIndex === 8) {
            playNoise({
                target: musicBus,
                filterType: 'bandpass',
                filterFreq: 400,
                filterFreqEnd: 3200,
                filterSweep: stepDur * 7.5,
                filterQ: 1.8,
                gain: 0.018 * I,
                attack: stepDur * 7,
                decay: 0.05,
                sustain: 0.004,
                release: 0.3,
                delay: when - ctx.currentTime,
                reverbSend: 0.3,
            });
        }
    }

    function startMusic() {
        var c = getCtx();
        if (!c || music.started) return;
        if (c.state === 'suspended') c.resume().catch(function () { });

        music.started = true;
        music.step = 0;
        music.bar = 0;

        var lookAhead = 0.14;
        var nextTime = c.currentTime + 0.06;

        music.timer = setInterval(function () {
            if (!music.started) return;
            var now = c.currentTime;
            // A backgrounded tab throttles timers; skip the backlog instead of firing it.
            if (nextTime < now - 0.5) nextTime = now + 0.05;
            while (nextTime < now + lookAhead) {
                scheduleMusicStep(music.step % 16, nextTime);
                music.step++;
                if (music.step % 16 === 0) music.bar++;
                nextTime += 60 / music.bpm / 4;
            }
        }, 50);
    }

    function stopMusic() {
        music.started = false;
        if (music.timer) {
            clearInterval(music.timer);
            music.timer = null;
        }
    }

    function setMusicIntensity(v) {
        music.targetIntensity = clamp(Number(v) || 0, 0, 1);
    }

    function setMusicMood(mood) {
        var next = mood === 'match' ? 'match' : 'menu';
        if (music.mood === next) return;
        music.mood = next;
        music.bpm = next === 'menu' ? 76 : 84;
        if (next === 'menu') {
            music.targetIntensity = 0.1;
            music.intensity = 0.1;
        }
        if (musicDelay) musicDelay.delayTime.value = (60 / music.bpm) * 0.75;
    }

    global.AudioFX = {
        click: uiClick,
        select: selectSound,
        send: sendSound,
        wormholeTeleport: wormholeTeleportSound,
        solarFlareWarning: solarFlareWarningSound,
        solarFlareBlast: solarFlareBlastSound,
        combat: combatSound,
        capture: captureSound,
        strategicPulse: strategicPulseSound,
        dominance: dominanceSound,
        denied: deniedSound,
        upgrade: upgradeSound,
        upgradeStart: upgradeStartSound,
        upgradeComplete: upgradeCompleteSound,
        victory: victorySound,
        defeat: defeatSound,
        achievement: achievementSound,
        setSfxVolume: function (v) {
            getCtx();
            if (sfxBus) sfxBus.gain.value = clamp(v, 0, 1.4);
        },
        setMusicVolume: function (v) {
            getCtx();
            if (musicBus) musicBus.gain.value = clamp(v, 0, 1.2);
        },
        startMusic: startMusic,
        stopMusic: stopMusic,
        setMusicIntensity: setMusicIntensity,
        setMusicMood: setMusicMood,
        planetLost: planetLostSound,
        distantCapture: distantCaptureSound,
        explosion: explosionSound,
    };
})(typeof window !== 'undefined' ? window : this);
