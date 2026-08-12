// Web Audio API Synthesizer for BYG CHAT Sound Effects
// Pure browser synthesizer for guaranteed offline/online playback without broken MP3 URLs

class SoundEffectsSystem {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private incomingRingInterval: any = null;
  private outgoingRingInterval: any = null;

  constructor() {
    // Check saved audio preference
    const saved = localStorage.getItem('byg_sound_enabled');
    if (saved !== null) {
      this.soundEnabled = saved === 'true';
    }
  }

  public isMuted(): boolean {
    return !this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem('byg_sound_enabled', String(enabled));
    if (!enabled) {
      this.stopAllRings();
    }
  }

  public toggleSound(): boolean {
    this.setSoundEnabled(!this.soundEnabled);
    return this.soundEnabled;
  }

  private getContext(): AudioContext | null {
    if (!this.soundEnabled) return null;
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch (e) {
      console.warn('AudioContext not supported or restricted:', e);
      return null;
    }
  }

  // 1. Send Message Sound (Soft organic "pop" with low-pass filtering)
  public playMessageSend(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      // Ignore
    }
  }

  // 2. Receive Message Sound (Elegant dual-tone bell with resonance)
  public playMessageReceive(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      const playBell = (freq: number, startTime: number, vol: number) => {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator(); // Sub-harmonic for warmth
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq / 2, startTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, startTime);

        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc2.start(startTime);
        osc.stop(startTime + 0.4);
        osc2.stop(startTime + 0.4);
      };

      playBell(880, now, 0.15); // A5
      playBell(1320, now + 0.05, 0.12); // E6
    } catch (e) {
      // Ignore
    }
  }

  // 3. Notification Chime (Clean high-pitched glass ping)
  public playNotificationChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1567.98, now); // G6

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      // Ignore
    }
  }

  // 4. Incoming Call Ringtone (Modern polyphonic melody)
  public startIncomingCallRing(): void {
    this.stopIncomingCallRing();
    if (!this.soundEnabled) return;

    const ringPulse = () => {
      const ctx = this.getContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;
        const melody = [
          { f: 659.25, t: 0 },   // E5
          { f: 880.00, t: 0.15 }, // A5
          { f: 1046.50, t: 0.3 }, // C6
          { f: 1318.51, t: 0.45 } // E6
        ];

        melody.forEach((note) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.f, now + note.t);
          gain.gain.setValueAtTime(0.12, now + note.t);
          gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + note.t);
          osc.stop(now + note.t + 0.6);
        });
      } catch (e) {
        // Ignore
      }
    };

    ringPulse();
    this.incomingRingInterval = setInterval(ringPulse, 1800);
  }

  public stopIncomingCallRing(): void {
    if (this.incomingRingInterval) {
      clearInterval(this.incomingRingInterval);
      this.incomingRingInterval = null;
    }
  }

  // 5. Outgoing Call Dialing Tone (Refined standard frequency pair)
  public startOutgoingCallRing(): void {
    this.stopOutgoingCallRing();
    if (!this.soundEnabled) return;

    const dialTone = () => {
      const ctx = this.getContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
        gain.gain.setValueAtTime(0.08, now + 1.2);
        gain.gain.linearRampToValueAtTime(0, now + 1.4);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.5);
        osc2.stop(now + 1.5);
      } catch (e) {
        // Ignore
      }
    };

    dialTone();
    this.outgoingRingInterval = setInterval(dialTone, 2500);
  }

  public stopOutgoingCallRing(): void {
    if (this.outgoingRingInterval) {
      clearInterval(this.outgoingRingInterval);
      this.outgoingRingInterval = null;
    }
  }

  // 6. Call End Tone (Soft dual-tone descension)
  public playCallEnd(): void {
    this.stopAllRings();
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      // Ignore
    }
  }

  // 7. Error/Failure Sound (Short low-pitched warning)
  public playError(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      // Ignore
    }
  }

  public stopAllRings(): void {
    this.stopIncomingCallRing();
    this.stopOutgoingCallRing();
  }
}

export const soundFx = new SoundEffectsSystem();
