/**
 * Efeitos sonoros sintetizados com WebAudio — sem assets externos.
 * Tudo comeca mudo ate a primeira interacao do usuario (politica dos navegadores).
 */

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambient: { gain: GainNode; src: AudioBufferSourceNode } | null = null
  muted = false

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.8
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.8, this.ctx.currentTime + 0.15)
    }
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  /** Murmurinho continuo da torcida. */
  startAmbient() {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.ambient) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(2.5)
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 480
    filter.Q.value = 0.35
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter).connect(gain).connect(this.master)
    src.start()
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.2)
    this.ambient = { gain, src }
  }

  whistle() {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(2350, t)
    const trill = ctx.createOscillator()
    trill.frequency.value = 38
    const trillGain = ctx.createGain()
    trillGain.gain.value = 220
    trill.connect(trillGain).connect(osc.frequency)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.06, t + 0.02)
    gain.gain.setValueAtTime(0.06, t + 0.5)
    gain.gain.linearRampToValueAtTime(0, t + 0.6)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    trill.start(t)
    osc.stop(t + 0.65)
    trill.stop(t + 0.65)
  }

  kick() {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.14)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.5, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.2)

    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer(0.1)
    const nf = ctx.createBiquadFilter()
    nf.type = 'lowpass'
    nf.frequency.value = 1400
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.22, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    noise.connect(nf).connect(ng).connect(this.master)
    noise.start(t)
  }

  /** Explosao da torcida no gol. */
  roar() {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer(3)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(500, t)
    filter.frequency.linearRampToValueAtTime(900, t + 0.4)
    filter.Q.value = 0.4
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.25)
    gain.gain.setValueAtTime(0.4, t + 1.4)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.8)
    noise.connect(filter).connect(gain).connect(this.master)
    noise.start(t)
  }

  /** Lamento da torcida na defesa ou chute para fora. */
  groan() {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer(1.6)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(620, t)
    filter.frequency.linearRampToValueAtTime(260, t + 0.9)
    filter.Q.value = 0.6
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
    noise.connect(filter).connect(gain).connect(this.master)
    noise.start(t)
  }

  destroy() {
    this.ambient?.src.stop()
    this.ambient = null
    void this.ctx?.close()
    this.ctx = null
    this.master = null
  }
}
