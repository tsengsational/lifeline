// Helper function to create a distortion curve for the WaveShaperNode
function makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        // Simple soft clipping curve
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

// Helper to convert an AudioBuffer to a WAV Blob
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([bufferArray], { type: 'audio/wav' });

    function setUint16(data: number) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data: number) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

export async function applyLoFiFilter(audioBlob: Blob): Promise<Blob> {
    // 1. Decode the recorded blob
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 2. Set up OfflineAudioContext for rendering
    const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // 3. Create Highpass Filter (approx 300Hz)
    const highpass = offlineContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 300;

    // 4. Create Lowpass Filter (approx 3400Hz) to simulate telephone bandwidth
    const lowpass = offlineContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3400;

    // 5. Create WaveShaper for slight distortion/clipping
    const waveShaper = offlineContext.createWaveShaper();
    waveShaper.curve = makeDistortionCurve(50); // amount of distortion
    waveShaper.oversample = '4x';

    // 6. Connect the nodes
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(waveShaper);
    waveShaper.connect(offlineContext.destination);

    // 7. Render audio
    source.start(0);
    const renderedBuffer = await offlineContext.startRendering();

    // 8. Convert back to Blob
    return audioBufferToWavBlob(renderedBuffer);
}
