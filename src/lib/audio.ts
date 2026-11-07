export type LabSoundKind = "enabled" | "opening" | "new" | "repeat" | "complete"

export interface ToneVoice {
  waveform: OscillatorType
  frequency: number
  endFrequency?: number
  offset: number
  duration: number
  gain: number
  attack?: number
  pan?: number
}

const tactileVoice: ToneVoice = {
  waveform: "triangle",
  frequency: 180,
  endFrequency: 120,
  offset: 0,
  duration: 0.075,
  gain: 0.014,
  attack: 0.006,
}

export const LAB_SOUND_PLANS: Readonly<Record<LabSoundKind, readonly ToneVoice[]>> = {
  enabled: [
    {
      waveform: "sine",
      frequency: 523.25,
      offset: 0,
      duration: 0.17,
      gain: 0.022,
      pan: -0.12,
    },
    {
      waveform: "sine",
      frequency: 659.25,
      offset: 0.055,
      duration: 0.2,
      gain: 0.026,
      pan: 0.12,
    },
  ],
  opening: [
    tactileVoice,
    {
      waveform: "triangle",
      frequency: 320,
      endFrequency: 180,
      offset: 0.018,
      duration: 0.17,
      gain: 0.012,
      pan: -0.14,
    },
    {
      waveform: "sine",
      frequency: 520,
      endFrequency: 390,
      offset: 0.055,
      duration: 0.16,
      gain: 0.007,
      pan: 0.16,
    },
  ],
  repeat: [
    tactileVoice,
    {
      waveform: "triangle",
      frequency: 220,
      endFrequency: 196,
      offset: 0.018,
      duration: 0.21,
      gain: 0.026,
      pan: -0.08,
    },
    {
      waveform: "sine",
      frequency: 440,
      endFrequency: 392,
      offset: 0.028,
      duration: 0.18,
      gain: 0.006,
      pan: 0.12,
    },
  ],
  new: [
    tactileVoice,
    {
      waveform: "sine",
      frequency: 659.25,
      offset: 0.025,
      duration: 0.29,
      gain: 0.035,
      pan: -0.2,
    },
    {
      waveform: "sine",
      frequency: 1318.51,
      offset: 0.03,
      duration: 0.2,
      gain: 0.006,
      pan: -0.14,
    },
    {
      waveform: "sine",
      frequency: 880,
      offset: 0.095,
      duration: 0.34,
      gain: 0.041,
      pan: 0.2,
    },
    {
      waveform: "sine",
      frequency: 1760,
      offset: 0.1,
      duration: 0.22,
      gain: 0.006,
      pan: 0.14,
    },
  ],
  complete: [
    tactileVoice,
    {
      waveform: "sine",
      frequency: 293.66,
      offset: 0.015,
      duration: 0.64,
      gain: 0.016,
    },
    {
      waveform: "sine",
      frequency: 587.33,
      offset: 0.025,
      duration: 0.43,
      gain: 0.031,
      pan: -0.3,
    },
    {
      waveform: "sine",
      frequency: 739.99,
      offset: 0.085,
      duration: 0.45,
      gain: 0.033,
      pan: -0.1,
    },
    {
      waveform: "sine",
      frequency: 880,
      offset: 0.145,
      duration: 0.48,
      gain: 0.037,
      pan: 0.12,
    },
    {
      waveform: "sine",
      frequency: 1174.66,
      offset: 0.21,
      duration: 0.5,
      gain: 0.041,
      pan: 0.3,
    },
  ],
}

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

const ignoreAudioError = () => undefined

export class LabAudioEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private echoInput: DelayNode | null = null
  private readonly activeOscillators = new Set<OscillatorNode>()
  private requestGeneration = 0
  private enabled = false
  private disposed = false

  setEnabled(enabled: boolean) {
    if (this.disposed || this.enabled === enabled) return
    this.enabled = enabled
    if (enabled) {
      void this.play("enabled")
    } else {
      this.requestGeneration += 1
      this.stopAll()
    }
  }

  async play(kind: LabSoundKind) {
    const requestGeneration = ++this.requestGeneration
    if (!this.enabled || this.disposed) return
    try {
      const context = this.ensureContext()
      if (!context || context.state === "closed") return
      if (context.state !== "running") {
        await context.resume().catch(ignoreAudioError)
      }
      if (
        requestGeneration !== this.requestGeneration ||
        !this.enabled ||
        this.disposed ||
        context !== this.context ||
        context.state !== "running"
      ) {
        return
      }

      this.restoreMaster(context)
      const now = context.currentTime + 0.008
      for (const voice of LAB_SOUND_PLANS[kind]) {
        this.scheduleVoice(context, voice, now)
      }
    } catch {
      // Unsupported or restricted Web Audio environments stay silently usable.
    }
  }

  dispose() {
    if (this.disposed) return
    this.requestGeneration += 1
    this.enabled = false
    this.disposed = true
    this.stopAll()
    const context = this.context
    this.context = null
    this.master = null
    this.echoInput = null
    if (context && context.state !== "closed") {
      void context.close().catch(ignoreAudioError)
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.context && this.context.state !== "closed") return this.context
    if (typeof window === "undefined") return null

    const AudioContextClass =
      window.AudioContext ?? (window as AudioWindow).webkitAudioContext
    if (!AudioContextClass) return null

    const context = new AudioContextClass()
    const master = context.createGain()
    const compressor = context.createDynamicsCompressor()
    const echo = context.createDelay(0.25)
    const feedback = context.createGain()
    const echoFilter = context.createBiquadFilter()
    const wet = context.createGain()

    master.gain.value = 0.78
    compressor.threshold.value = -18
    compressor.knee.value = 12
    compressor.ratio.value = 4
    compressor.attack.value = 0.003
    compressor.release.value = 0.16
    echo.delayTime.value = 0.074
    feedback.gain.value = 0.135
    echoFilter.type = "lowpass"
    echoFilter.frequency.value = 3000
    wet.gain.value = 0.105

    master.connect(compressor)
    compressor.connect(context.destination)
    echo.connect(echoFilter)
    echo.connect(feedback)
    feedback.connect(echo)
    echoFilter.connect(wet)
    wet.connect(master)

    this.context = context
    this.master = master
    this.echoInput = echo
    return context
  }

  private restoreMaster(context: AudioContext) {
    if (!this.master) return
    const now = context.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now)
    this.master.gain.exponentialRampToValueAtTime(0.78, now + 0.018)
  }

  private scheduleVoice(context: AudioContext, voice: ToneVoice, now: number) {
    if (!this.master || !this.echoInput) return
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const panner = typeof context.createStereoPanner === "function"
      ? context.createStereoPanner()
      : null
    const start = now + voice.offset
    const stop = start + voice.duration
    const attack = Math.min(voice.attack ?? 0.008, voice.duration * 0.24)

    oscillator.type = voice.waveform
    oscillator.frequency.setValueAtTime(voice.frequency, start)
    if (voice.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(voice.endFrequency, stop)
    }
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(voice.gain, start + attack)
    envelope.gain.exponentialRampToValueAtTime(0.0001, stop)

    oscillator.connect(envelope)
    const output: AudioNode = panner ?? envelope
    if (panner) {
      panner.pan.value = voice.pan ?? 0
      envelope.connect(panner)
    }
    output.connect(this.master)
    output.connect(this.echoInput)

    this.activeOscillators.add(oscillator)
    oscillator.addEventListener(
      "ended",
      () => {
        this.activeOscillators.delete(oscillator)
        oscillator.disconnect()
        envelope.disconnect()
        panner?.disconnect()
      },
      { once: true },
    )
    oscillator.start(start)
    oscillator.stop(stop + 0.012)
  }

  private stopAll() {
    const context = this.context
    if (!context || context.state === "closed") return
    const now = context.currentTime
    if (this.master) {
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now)
      this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
    }
    for (const oscillator of this.activeOscillators) {
      try {
        oscillator.stop(now + 0.045)
      } catch {
        // The oscillator may already have reached its scheduled stop time.
      }
    }
  }
}
