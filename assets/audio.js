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

    var music = {
        started: false,
        timer: null,
        bpm: 96,
        step: 0,
        bar: 0,
        progression: [
            { root: 98.0, chord: [0, 3, 7, 10] },
            { root: 110.0, chord: [0, 3, 7, 10] },
            { root: 123.47, chord: [0, 4, 7, 11] },
            { root: 82.41, chord: [0, 3, 7, 10] },
        ],
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

        gainParam.cancelScheduledValues(now);
        gainParam.setValueAtTime(0.0001, now);
        gainParam.exponentialRampToValueAtTime(peak, now + a);
        gainParam.exponentialRampToValueAtTime(s, now + a + d);
        gainParam.exponentialRampToValueAtTime(0.0001, now + a + d + r);
        return now + a + d + r;
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

        var end = envGain(gain.gain, now, {
            attack: opt.attack,
            decay: opt.decay,
            sustain: opt.sustain,
            release: opt.release,
            peak: opt.gain,
        });

        osc.start(now);
        osc.stop(end + 0.02);
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
            release: opt.release,
            peak: opt.gain,
        });

        src.start(now);
        src.stop(end + 0.03);
    }

    function uiClick() {
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

    function sendSound() {
        var pan = rand(-0.25, 0.25);
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

    function combatSound() {
        var c = getCtx();
        if (!c) return;
        var now = c.currentTime;

        // Combat can happen in bursts; clamp trigger rate to avoid harsh spam.
        if (now - lastCombatAt < 0.065) return;
        lastCombatAt = now;

        var pan = rand(-0.28, 0.28);
        var accent = combatAccentFlip;
        combatAccentFlip = !combatAccentFlip;

        // Low-mid body thump.
        playOsc({
            type: 'sine',
            freq: accent ? 118 : 104,
            freqEnd: 62,
            sweep: 0.12,
            gain: 0.095,
            attack: 0.001,
            decay: 0.02,
            sustain: 0.03,
            release: 0.14,
            pan: pan * 0.2,
        });

        // Short texture crack without piercing highs.
        playNoise({
            filterType: accent ? 'bandpass' : 'lowpass',
            filterFreq: accent ? 980 : 760,
            filterFreqEnd: accent ? 480 : 220,
            filterSweep: 0.1,
            filterQ: accent ? 1.1 : 0.65,
            gain: accent ? 0.085 : 0.07,
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
            gain: 0.04,
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

    function captureSound() {
        var notes = [392, 494, 587, 784];
        for (var i = 0; i < notes.length; i++) {
            playOsc({
                type: i % 2 ? 'triangle' : 'sine',
                freq: notes[i],
                gain: 0.085 - i * 0.01,
                attack: 0.002,
                decay: 0.045,
                sustain: 0.04,
                release: 0.2,
                delay: i * 0.055,
                reverbSend: 0.2,
            });
        }
        playNoise({
            filterType: 'highpass',
            filterFreq: 3200,
            gain: 0.02,
            attack: 0.001,
            decay: 0.02,
            sustain: 0.01,
            release: 0.15,
            delay: 0.05,
            reverbSend: 0.25,
        });
    }

    function upgradeSound() {
        playOsc({
            type: 'square',
            freq: 430,
            freqEnd: 980,
            sweep: 0.17,
            gain: 0.075,
            attack: 0.002,
            decay: 0.03,
            sustain: 0.04,
            release: 0.14,
            filterType: 'bandpass',
            filterFreq: 1500,
            filterQ: 2.8,
            reverbSend: 0.12,
        });
        playOsc({
            type: 'triangle',
            freq: 670,
            freqEnd: 1240,
            sweep: 0.12,
            gain: 0.045,
            attack: 0.001,
            decay: 0.02,
            sustain: 0.02,
            release: 0.11,
            delay: 0.015,
        });
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

    function scheduleMusicStep(stepIndex, when) {
        var prog = music.progression[music.bar % music.progression.length];
        var rootMidi = 45 + (Math.log(prog.root / 110.0) / Math.log(2)) * 12;
        var chord = prog.chord;

        // Kick-like pulse
        if (stepIndex % 8 === 0) {
            playOsc({
                target: musicBus,
                type: 'sine',
                freq: 88,
                freqEnd: 42,
                sweep: 0.11,
                gain: 0.12,
                attack: 0.001,
                decay: 0.03,
                sustain: 0.02,
                release: 0.08,
                delay: when - ctx.currentTime,
            });
        }

        // Bass groove
        if (stepIndex % 4 === 0 || stepIndex % 7 === 3) {
            var bassMidi = rootMidi + (stepIndex % 8 === 4 ? 7 : 0);
            playOsc({
                target: musicBus,
                type: 'triangle',
                freq: midiToHz(bassMidi),
                freqEnd: midiToHz(bassMidi - 5),
                sweep: 0.2,
                gain: 0.065,
                attack: 0.002,
                decay: 0.04,
                sustain: 0.03,
                release: 0.16,
                delay: when - ctx.currentTime,
                filterType: 'lowpass',
                filterFreq: 700,
                filterQ: 1.1,
                reverbSend: 0.05,
            });
        }

        // Ambient pad on bar start
        if (stepIndex === 0) {
            for (var i = 0; i < chord.length; i++) {
                playOsc({
                    target: musicBus,
                    type: 'sine',
                    freq: midiToHz(rootMidi + 12 + chord[i]),
                    gain: 0.022,
                    attack: 0.08,
                    decay: 0.25,
                    sustain: 0.018,
                    release: 0.9,
                    delay: when - ctx.currentTime,
                    pan: -0.35 + i * 0.25,
                    reverbSend: 0.32,
                    filterType: 'lowpass',
                    filterFreq: 1400,
                });
            }
        }

        // Soft top arpeggio
        if (stepIndex % 2 === 1) {
            var arpIx = (stepIndex + music.bar) % chord.length;
            var noteMidi = rootMidi + 24 + chord[arpIx];
            playOsc({
                target: musicBus,
                type: 'triangle',
                freq: midiToHz(noteMidi),
                gain: 0.028,
                attack: 0.002,
                decay: 0.03,
                sustain: 0.01,
                release: 0.12,
                delay: when - ctx.currentTime,
                pan: rand(-0.25, 0.25),
                reverbSend: 0.22,
                filterType: 'bandpass',
                filterFreq: 1800,
                filterQ: 1.2,
            });
        }

        // Whisper hat
        if (stepIndex % 4 === 2) {
            playNoise({
                target: musicBus,
                filterType: 'highpass',
                filterFreq: 4800,
                gain: 0.006,
                attack: 0.001,
                decay: 0.01,
                sustain: 0.002,
                release: 0.04,
                delay: when - ctx.currentTime,
                pan: rand(-0.35, 0.35),
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

        var stepDur = 60 / music.bpm / 4; // 16th notes
        var lookAhead = 0.12;
        var nextTime = c.currentTime + 0.05;

        music.timer = setInterval(function () {
            if (!music.started) return;
            var now = c.currentTime;
            while (nextTime < now + lookAhead) {
                scheduleMusicStep(music.step % 16, nextTime);
                music.step++;
                if (music.step % 16 === 0) music.bar++;
                nextTime += stepDur;
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

    global.AudioFX = {
        click: uiClick,
        select: selectSound,
        send: sendSound,
        combat: combatSound,
        capture: captureSound,
        upgrade: upgradeSound,
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
    };
})(typeof window !== 'undefined' ? window : this);
