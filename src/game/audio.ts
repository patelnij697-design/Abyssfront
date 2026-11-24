class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(m: boolean) {
    this.muted = m;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playWeapon(type: 'plasma_rifle' | 'pulse_shotgun' | 'ion_sniper' | 'maelstrom', suppressed = false) {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'plasma_rifle') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(suppressed ? 420 : 620, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.11);
      gain.gain.setValueAtTime(suppressed ? 0.06 : 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'pulse_shotgun') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'ion_sniper') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.28);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
      osc.start(now);
      osc.stop(now + 0.29);
    } else {
      // Maelstrom Supergun
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.55);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
      osc.start(now);
      osc.stop(now + 0.56);
    }
  }

  public playTone(freq: number, duration = 0.15, type: OscillatorType = 'sine', vol = 0.09) {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  public playKlaxon() {
    this.playTone(540, 0.18, 'square', 0.07);
    setTimeout(() => this.playTone(410, 0.18, 'square', 0.07), 190);
  }

  public playPickup() {
    this.playTone(520, 0.08, 'sine', 0.08);
    setTimeout(() => this.playTone(760, 0.12, 'sine', 0.08), 70);
  }

  public playScan() {
    this.playTone(880, 0.09, 'triangle', 0.06);
  }

  public playHurt() {
    this.playTone(110, 0.22, 'sawtooth', 0.14);
  }

  public playOrrinChord() {
    [220, 330, 440, 660].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.5, 'sine', 0.06), idx * 45);
    });
  }

  public playOxygenAlert(critical = false) {
    if (critical) {
      this.playTone(960, 0.11, 'triangle', 0.12);
      setTimeout(() => this.playTone(720, 0.14, 'triangle', 0.12), 130);
      setTimeout(() => this.playTone(960, 0.11, 'triangle', 0.11), 280);
    } else {
      this.playTone(780, 0.14, 'sine', 0.1);
      setTimeout(() => this.playTone(580, 0.18, 'sine', 0.09), 150);
    }
  }

  public playHatch() {
    this.playTone(210, 0.12, 'triangle', 0.1);
    setTimeout(() => this.playTone(145, 0.16, 'sine', 0.09), 90);
  }
}

export const sound = new SoundEngine();
