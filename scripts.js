const FADE_DURATION = 5;
let filter = null;
let filter2 = null;
let whiteNoise = null;
let gainNode = null;
let isPlaying = false;
let stopTimeout = null;


// 🎧 AudioContext a Analyser hned od začátku
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;

let bufferLength = analyser.frequencyBinCount;
let dataArray = new Uint8Array(bufferLength);

// 🎨 Canvas setup
let canvas = document.getElementById("spectrum");
let ctx = canvas.getContext("2d");

function resizeSpectrum() {
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
    canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
    canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
}
resizeSpectrum();
new ResizeObserver(resizeSpectrum).observe(canvas);

// 🔄 Spektrum – běží hned od začátku
function drawSpectrum() {
    requestAnimationFrame(drawSpectrum);

    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = "#151515";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const vertical = canvas.height > canvas.width;
    const gap = devicePixelRatio;

    if (vertical) {
        const thickness = (canvas.height - gap * bufferLength) / bufferLength;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i];
            const length = v / 255 * canvas.width;
            const y = canvas.height - (i + 1) * (thickness + gap);
            ctx.fillStyle = `rgb(${v + 100}, 50, 150)`;
            ctx.fillRect(canvas.width - length, y, length, thickness);
        }
    } else {
        const thickness = (canvas.width - gap * bufferLength) / bufferLength;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i];
            const length = v / 255 * canvas.height;
            ctx.fillStyle = `rgb(${v + 100}, 50, 150)`;
            ctx.fillRect(i * (thickness + gap), canvas.height - length, thickness, length);
        }
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

// --- ▶️ Spuštění šumu
function startNoise() {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (stopTimeout) {
        clearTimeout(stopTimeout);
        stopTimeout = null;
        const now = audioCtx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(1, now + FADE_DURATION);
        return;
    }

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
    filter.Q.setValueAtTime(document.getElementById('qSlider').value, audioCtx.currentTime);
    

    filter2 = audioCtx.createBiquadFilter();
    filter2.type = "peaking";
    filter2.frequency.setValueAtTime(document.getElementById('freqSlider2').value, audioCtx.currentTime);
    filter2.Q.setValueAtTime(document.getElementById('qSlider2').value, audioCtx.currentTime);
    filter2.gain.setValueAtTime(document.getElementById('gainSlider2').value, audioCtx.currentTime);


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

// --- ⏹ Zastavení šumu
function stopNoise() {
  if (!isPlaying || !gainNode || !audioCtx || stopTimeout) return;

  const now = audioCtx.currentTime;

  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.setTargetAtTime(0, now, 1.5);

  stopTimeout = setTimeout(() => {
    stopTimeout = null;
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


// --- Timer (Rive)
const timerCanvas = document.getElementById('timer-canvas');

timerCanvas.addEventListener('pointerdown', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
});

const timerRive = new rive.Rive({
    src: 'noise_timer_ui.riv',
    canvas: timerCanvas,
    autoplay: true,
    stateMachines: 'State Machine 1',
    isTouchScrollEnabled: false,
    autoBind: true,
    layout: new rive.Layout({
        fit: rive.Fit.Contain,
        alignment: rive.Alignment.Center,
    }),
    onLoad: () => {
        timerRive.resizeDrawingSurfaceToCanvas();

        const vmi = timerRive.viewModelInstance;
        const time = vmi.number('time');
        const grabbed = vmi.boolean('isHandleGrabbed');
        const backgroundColor = vmi.color('backgroundColor');

        backgroundColor.value = 0x00282828;

        let lastTime = time.value;
        time.on(() => {
            const v = time.value;
            if (lastTime > 0 && v <= 0 && !grabbed.value) {
                stopNoise();
            }
            lastTime = v;
        });

        grabbed.on(() => {
            if (grabbed.value) return;
            if (time.value > 0) {
                startNoise();
            } else {
                stopNoise();
            }
        });
    },
    onLoadError: (e) => console.error('Rive load error', e),
});

window.addEventListener('resize', () => timerRive.resizeDrawingSurfaceToCanvas());

// Schování sliderů
const collapse = document.getElementById("collapse");
const collapseIndicator = document.getElementById("collapse-indicator");

 collapse.addEventListener('click', function() {
    let content = this.nextElementSibling;
    if(content.style.maxHeight){
        content.style.maxHeight = null;
        document.querySelector('.app').classList.remove('filters-open');
        collapseIndicator.textContent = '+';
    } else {
        content.style.maxHeight = content.scrollHeight + "px";
        document.querySelector('.app').classList.add('filters-open');
        collapseIndicator.textContent = '-';
        setTimeout(()=>{
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
              });
        },350)
    }
 });

// --- Slidery a numerické inputy pro ovládání filtrů

// Vyplnění dráhy slideru podle aktuální hodnoty (WebKit nemá ::range-progress)
function updateSliderFill(slider) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const progress = (parseFloat(slider.value) - min) / (max - min) * 100;
    slider.style.setProperty('--progress', `${progress}%`);
}

// Low pass freq
function updateFrequency(value) {
    // Update both UI elements
    const min = 20;
    const max = 10000;
    value = Math.max(min, Math.min(max, value || min));    
    
    freqSlider.value = value;
    freqNumber.value = value;
    updateSliderFill(freqSlider);

    // Apply the frequency
    if (filter) {
        const freq = parseFloat(value);
        filter.frequency.setValueAtTime(freq, audioCtx.currentTime);
    }
}

const freqNumber = document.getElementById('freqNumber');
freqNumber.addEventListener('change', (event) => {
    updateFrequency(event.target.value);
});

const freqSlider = document.getElementById('freqSlider');
freqSlider.addEventListener('input', (event) => {
    updateFrequency(event.target.value)
});


// Low pass Q
function updateQ(value) {
    const min = 0.01;
    const max = 5;
    value = Math.max(min, Math.min(max, value || min));

    qSlider.value = value;
    qNumber.value = value;
    updateSliderFill(qSlider);

    if (filter) {
        const q =parseFloat(value);
        filter.Q.setValueAtTime(q, audioCtx.currentTime);
    }
}

const qNumber = document.getElementById('qNumber');
qNumber.addEventListener('change', (event) => {
    updateQ(event.target.value)
});

const qSlider = document.getElementById('qSlider');
qSlider.addEventListener('input', (event) => {
    updateQ(event.target.value)
});



// Peak filter gain
function updateGain2(value) {
    const min = -90;
    const max = 90;
    value = Math.max(min, Math.min(max, value || min));

    gainSlider2.value = value;
    gainNumber2.value = value;
    updateSliderFill(gainSlider2);

    if (filter2) {
        const gain = parseFloat(value);
        filter2.gain.setValueAtTime(gain, audioCtx.currentTime); 
    }
}

const gainNumber2 = document.getElementById('gainNumber2');
gainNumber2.addEventListener('change', (event) => {
    updateGain2(event.target.value);
})

const gainSlider2 = document.getElementById('gainSlider2');
gainSlider2.addEventListener('input', (event) => {
    updateGain2(event.target.value);
});

// Peak filter freq
function updateFrequency2(value){
    const min = 20;
    const max = 10000;
    value = Math.max(min, Math.min(max, value || min));

    freqSlider2.value = value;
    freqNumber2.value = value;
    updateSliderFill(freqSlider2);

    if (filter2) {
        const freq = parseFloat(value);
        filter2.frequency.setValueAtTime(freq, audioCtx.currentTime);
    }
}

const freqNumber2 = document.getElementById('freqNumber2');
freqNumber2.addEventListener('change', (event) => {
    updateFrequency2(event.target.value);
})

const freqSlider2 = document.getElementById('freqSlider2');
freqSlider2.addEventListener('input', (event) => {
    updateFrequency2(event.target.value);
});


// Peak filter Q
function updateQ2(value) {
    const min = 0.01;
    const max = 5;
    value = Math.max(min, Math.min(max, value || min));

    qSlider2.value = value;
    qNumber2.value = value;
    updateSliderFill(qSlider2);

    if (filter2) {
        const q = parseFloat(value);
        filter2.Q.setValueAtTime(q, audioCtx.currentTime)
    }
}

const qNumber2 = document.getElementById('qNumber2');
qNumber2.addEventListener('change', (event) => {
    updateQ2(event.target.value);
})

const qSlider2 = document.getElementById('qSlider2');
qSlider2.addEventListener('input', (event) => {
    updateQ2(event.target.value)
});


// --- Presety
function applyPreset(preset){
    updateFrequency(preset.lpf);
    updateQ(preset.lpq);
    updateGain2(preset.pfg);
    updateFrequency2(preset.pff);
    updateQ2(preset.pfq);
}

const presetDeepBrownian = {
    lpf : 2071,
    lpq : 0.01,
    pfg : -54,
    pff : 3513,
    pfq : 1.8
}

const presetDeepPink = {
    lpf : 2927,
    lpq : 0.01,
    pfg : -42,
    pff : 4147,
    pfq : 0.64
}

const presetBrownian = {
    lpf : 741,
    lpq : 0.01,
    pfg : -17,
    pff : 646,
    pfq : 0.24
}

const presetPink = {
    lpf : 7616,
    lpq : 0.01,
    pfg : -31,
    pff : 7901,
    pfq : 0.1
}


applyPreset(presetDeepBrownian);