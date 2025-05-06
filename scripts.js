const FADE_DURATION = 5;
let filter = null;
let filter2 = null;
let whiteNoise = null;
let gainNode = null;
let isPlaying = false;


// 🎧 AudioContext a Analyser hned od začátku
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;

let bufferLength = analyser.frequencyBinCount;
let dataArray = new Uint8Array(bufferLength);

// 🎨 Canvas setup
let canvas = document.getElementById("spectrum");
let ctx = canvas.getContext("2d");

// 🔄 Spektrum – běží hned od začátku
function drawSpectrum() {
    requestAnimationFrame(drawSpectrum);

    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = "#151515";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    

    const barWidth = ((canvas.width - bufferLength) / bufferLength) * 1;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i];
        ctx.fillStyle = `rgb(${barHeight + 100}, 50, 150)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}
drawSpectrum();

// 📈 Křivky pro fade in/out
const curve = new Float32Array(100);
for (let i = 0; i < curve.length; i++) {
    const t = i / (curve.length - 1);
    curve[i] = t * t; // quadratic ease-in
}
const reverseCurve = new Float32Array(100);
for (let i = 0; i < reverseCurve.length; i++) {
    const t = i / (reverseCurve.length - 1);
    reverseCurve[i] = (1 - t) * (1 - t); // quadratic ease-out
}

// ▶️ Spuštění šumu
function startNoise() {
    if (isPlaying) return;
    isPlaying = true;

    const bufferSize = 10 * audioCtx.sampleRate; 
        console.log("Sample rate " + audioCtx.sampleRate)
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
  }

    whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(document.getElementById('freqSlider').value, audioCtx.currentTime);
    filter.Q.setValueAtTime(document.getElementById('QSlider').value, audioCtx.currentTime);
    

    filter2 = audioCtx.createBiquadFilter();
    filter2.type = "peaking";
    filter2.frequency.setValueAtTime(document.getElementById('freqSlider2').value, audioCtx.currentTime);
    filter2.Q.setValueAtTime(document.getElementById('QSlider2').value, audioCtx.currentTime);
    filter2.gain.setValueAtTime(document.getElementById('GainSlider2').value, audioCtx.currentTime);


    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime); // start silent

    // 🔀 Propojení do analyzeru
    whiteNoise.connect(filter);
    filter.connect(filter2)
    filter2.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    // Fade in
    gainNode.gain.setValueCurveAtTime(curve, audioCtx.currentTime, FADE_DURATION);

    whiteNoise.start();
}

// ⏹ Zastavení šumu
function stopNoise() {
  if (!isPlaying || !gainNode || !audioCtx) return;

  const now = audioCtx.currentTime;

  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.setTargetAtTime(0, now, 1.5);

  setTimeout(() => {
    if (whiteNoise) {
        whiteNoise.stop();
        whiteNoise.disconnect();
        whiteNoise = null;
    }
    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }
    isPlaying = false;
  }, 10000);
}


// Timer
const clock = document.getElementById('clock');
let clockInterval = null;

function timeFormat(seconds){
    let min = Math.floor(seconds / 60);
    if (min < 10){ min = '0' + min; }

    let sec = seconds % 60;
    if (sec < 10){ sec = '0' + sec; }

    const time = min + ':' + sec; 

    return time;
}

function timer(time){
    if(!(typeof time === 'number' || time > 0) ){
        console.log('invalid timer input')
        return;
    }

    time = time*60;

    if (clockInterval){
        clearInterval(clockInterval);
    }

    let i = 0;
    clockInterval = setInterval(() => {
        clock.textContent = timeFormat(time - i);
        if(i >= time){
            stopNoise()
            clearInterval(clockInterval);
        }
        i++;
    },1000);
}

// Schování sliderů
let collapse = document.getElementById("collapse");
 collapse.addEventListener('click', function() {
    let content = this.nextElementSibling;
    if(content.style.maxHeight){
        content.style.maxHeight = null;
    } else {
        content.style.maxHeight = content.scrollHeight + "px";
    }
 })



//  Slidery pro ladění frekvence

document.getElementById('freqSlider').addEventListener('input', (e) => {
    if (filter) {
            const freq = parseFloat(e.target.value);
            filter.frequency.setValueAtTime(freq, audioCtx.currentTime);
    }
});

document.getElementById('QSlider').addEventListener('input', (e) => {
    if (filter) {
        const q = parseFloat(e.target.value);
        filter.Q.setValueAtTime(q, audioCtx.currentTime);
    }
})

document.getElementById('GainSlider2').addEventListener('input', (e) => {
    if (filter2) {
        const fGain = parseFloat(e.target.value);
        filter2.gain.setValueAtTime(fGain, audioCtx.currentTime);
    }
});

document.getElementById('freqSlider2').addEventListener('input', (e) => {
    if (filter2) {
        const freq = parseFloat(e.target.value);
        filter2.frequency.setValueAtTime(freq, audioCtx.currentTime);
    }
});

document.getElementById('QSlider2').addEventListener('input', (e) => {
    if (filter2) {
        const q = parseFloat(e.target.value);
        filter2.Q.setValueAtTime(q, audioCtx.currentTime);
    }
})


