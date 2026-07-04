/**
 * Efeitos sonoros sintetizados com WebAudio — sem assets externos.
 * Tudo comeca mudo ate a primeira interacao do usuario (politica dos navegadores).
 */

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambientAudio: HTMLAudioElement | null = null
  private crowdAudio: HTMLAudioElement | null = null
  private goalAudio: HTMLAudioElement | null = null
  private winAudio: HTMLAudioElement | null = null
  private crowdFadeInterval: number | null = null
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
    if (this.winAudio) {
      this.winAudio.muted = m
    }
    if (this.ambientAudio) {
      this.ambientAudio.muted = m
    }
    if (this.crowdAudio) {
      this.crowdAudio.muted = m
    }
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  /** Murmurinho continuo da torcida (arquivo mp3 real). */
  startAmbient() {
    if (typeof window === 'undefined') return
    if (!this.ambientAudio) {
      this.ambientAudio = new Audio('/ambient.mp3')
      this.ambientAudio.loop = true
      this.ambientAudio.volume = 0.04 // Mantido volume original
    }
    if (!this.crowdAudio) {
      this.crowdAudio = new Audio('/crowd.mp3')
      this.crowdAudio.loop = true
      this.crowdAudio.volume = 0.04 // som de fundo de estádio lotado
    }

    this.ambientAudio.muted = this.muted
    this.crowdAudio.muted = this.muted

    void this.ambientAudio.play().catch(() => { /* ignora erro de autoplay */ })
    void this.crowdAudio.play().catch(() => { /* ignora erro de autoplay */ })
  }

  playGoalCrowd() {
    if (typeof window === 'undefined') return
    if (!this.goalAudio) {
      this.goalAudio = new Audio('/goal.mp3')
    }
    if (this.crowdFadeInterval) {
      clearInterval(this.crowdFadeInterval)
      this.crowdFadeInterval = null
    }
    this.goalAudio.muted = this.muted
    this.goalAudio.volume = 0.01
    this.goalAudio.currentTime = 1
    void this.goalAudio.play().catch(() => { })
  }

  stopGoalCrowd() {
    if (!this.goalAudio) return
    const fadeSteps = 20
    const stepTime = 1000 / fadeSteps
    const startVolume = this.goalAudio.volume
    const volumeStep = startVolume / fadeSteps
    let currentStep = 0

    if (this.crowdFadeInterval) clearInterval(this.crowdFadeInterval)

    this.crowdFadeInterval = window.setInterval(() => {
      currentStep++
      if (currentStep >= fadeSteps || !this.goalAudio) {
        if (this.goalAudio) {
          this.goalAudio.pause()
          this.goalAudio.volume = 0.1
        }
        if (this.crowdFadeInterval) clearInterval(this.crowdFadeInterval)
        this.crowdFadeInterval = null
      } else {
        this.goalAudio.volume = Math.max(0, startVolume - (volumeStep * currentStep))
      }
    }, stepTime)
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

  playWinModal() {
    if (typeof window === 'undefined') return
    if (!this.winAudio) {
      this.winAudio = new Audio('https://fpp-assets.play55.com.br/bpp/play55/roleta-v2/abrir-modal-ganhou.mp3')
    }
    this.winAudio.muted = this.muted
    this.winAudio.currentTime = 0
    void this.winAudio.play().catch(() => { /* ignora erro de autoplay */ })
  }

  destroy() {
    if (this.crowdFadeInterval) {
      clearInterval(this.crowdFadeInterval)
      this.crowdFadeInterval = null
    }
    if (this.ambientAudio) {
      this.ambientAudio.pause()
      this.ambientAudio.src = ''
    }
    if (this.crowdAudio) {
      this.crowdAudio.pause()
      this.crowdAudio.src = ''
    }
    if (this.goalAudio) {
      this.goalAudio.pause()
      this.goalAudio.src = ''
    }
    this.ambientAudio = null
    this.crowdAudio = null
    this.goalAudio = null

    void this.ctx?.close()
    this.ctx = null
    this.master = null
  }
}
