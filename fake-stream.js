/**
 * vendor/fake-stream.js
 *
 * Synthetic LLM stream emitter for Phase A demos.
 * Feeds DriftEngine.pushTokens(role, text) at realistic rates so the
 * void *feels* like a chat — without any provider wiring.
 *
 * Each "turn" emits tokens at ~60 tok/sec with mild jitter, which is faster
 * than the configured reveal WPM, so the buffer trail visibly grows during
 * generation and drains as the user reads.
 */

const TOKEN_RATE_HZ = 60;
const JITTER_MS = 25;

const SCRIPTS = [
  {
    role: 'system',
    text: 'st8 / sirkits — phase A drift surface online. type from the line.',
  },
  {
    role: 'user',
    text: 'okay show me what this thing can do.',
  },
  {
    role: 'assistant',
    text:
      'sure. words enter from the cyan line and rise through the void at reading pace. the cursor pulses on each reveal tick — that is the conversation\'s heartbeat. when the model is ahead of you, a faint trail of dots extends from the cursor showing how many words are queued. when the model stalls, the trail thins. the void shows you what the model is doing.',
  },
  {
    role: 'user',
    text: 'and the obstacles?',
  },
  {
    role: 'assistant',
    text:
      'sirkits sit anywhere in the void. drifting prose wraps around them via pretext — line by line, in real time, no flicker. drag a sirkit and the reveal queue pauses; release it and the prose resumes against the new geometry. this is the foundation. file explorers, terminals, music embeds, images — every spawnable surface plugs into this same drift field as another rect. one mental model, no chrome, no boxes, just a line and a void.',
  },
];

export class FakeStream {
  constructor(engine, { scripts = SCRIPTS, betweenTurnsMs = 1200 } = {}) {
    this.engine = engine;
    this.scripts = scripts;
    this.betweenTurnsMs = betweenTurnsMs;
    this._stopped = false;
    this._paused  = false;
    this._idx = 0;
  }

  start() {
    if (this._stopped) return;
    this._runNext();
  }

  stop()   { this._stopped = true; }
  pause()  { this._paused  = true; }
  resume() { if (!this._paused) return; this._paused = false; if (!this._stopped) this._runNext(); }

  _runNext() {
    if (this._stopped || this._paused) return;
    if (this._idx >= this.scripts.length) {
      // Loop back to start after a longer pause.
      setTimeout(() => { this._idx = 0; this._runNext(); }, this.betweenTurnsMs * 4);
      return;
    }
    const turn = this.scripts[this._idx++];
    this._emitTurn(turn).then(() => {
      setTimeout(() => this._runNext(), this.betweenTurnsMs);
    });
  }

  async _emitTurn(turn) {
    // Tokenize into ~3-char chunks like a real subword stream.
    const tokens = [];
    let i = 0;
    while (i < turn.text.length) {
      const len = 2 + Math.floor(Math.random() * 4);
      tokens.push(turn.text.slice(i, i + len));
      i += len;
    }
    const baseDelay = 1000 / TOKEN_RATE_HZ;
    for (const t of tokens) {
      if (this._stopped) return;
      // Wait out any pause before emitting the next token.
      while (this._paused && !this._stopped) {
        await new Promise(r => setTimeout(r, 80));
      }
      if (this._stopped) return;
      this.engine.pushTokens(turn.role, t);
      const jitter = (Math.random() - 0.5) * JITTER_MS;
      await new Promise(r => setTimeout(r, baseDelay + jitter));
    }
    this.engine.endTurn();
  }
}
