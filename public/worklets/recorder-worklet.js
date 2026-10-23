class RecPcmCollector extends AudioWorkletProcessor {
  private _buf;
  private _count;

  constructor() {
    super();
    this._buf = [];
    this._count = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this._buf.push(new Float32Array(input[0]));
      this._count += input[0].length;
      if (this._count >= 2048) {
        const merged = new Float32Array(this._count);
        let off = 0;
        for (const b of this._buf) {
          merged.set(b, off);
          off += b.length;
        }
        this._buf = [];
        this._count = 0;
        this.port.postMessage(merged, [merged.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("rec-pcm-collector", RecPcmCollector);
