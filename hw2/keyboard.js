import { confettiHelper } from "./confetti.js";


// ADSR and global vars
const globalGainMax = 0.6;
const attackMaxGain = 0.5;
const attackConstant = 0.002;
const attackTime = 0.01;
const decayConstant = 0.002;
const sustainGain = 0.3;
const releaseConstant = 0.01;
const epsilon = 0.001;

export const keyboardFrequencyMap = {
    '90': 261.625565300598634,  //Z - C
    '83': 277.182630976872096, //S - C#
    '88': 293.664767917407560,  //X - D
    '68': 311.126983722080910, //D - D#
    '67': 329.627556912869929,  //C - E
    '86': 349.228231433003884,  //V - F
    '71': 369.994422711634398, //G - F#
    '66': 391.995435981749294,  //B - G
    '72': 415.304697579945138, //H - G#
    '78': 440.000000000000000,  //N - A
    '74': 466.163761518089916, //J - A#
    '77': 493.883301256124111,  //M - B
    '81': 523.251130601197269,  //Q - C
    '50': 554.365261953744192, //2 - C#
    '87': 587.329535834815120,  //W - D
    '51': 622.253967444161821, //3 - D#
    '69': 659.255113825739859,  //E - E
    '82': 698.456462866007768,  //R - F
    '53': 739.988845423268797, //5 - F#
    '84': 783.990871963498588,  //T - G
    '54': 830.609395159890277, //6 - G#
    '89': 880.000000000000000,  //Y - A
    '55': 932.327523036179832, //7 - A#
    '85': 987.766602512248223,  //U - B
}

var synthType = document.querySelector('input[name="synthesis"]:checked').value
var waveformType = document.querySelector('input[name="waveform"]:checked').value
const synthControlsContainer = document.getElementById("synthControlsContainer");

document.addEventListener("DOMContentLoaded", function (event) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const globalGain = audioCtx.createGain(); //this will control the volume of all notes
    globalGain.gain.setValueAtTime(globalGainMax, audioCtx.currentTime)
    globalGain.connect(audioCtx.destination);

    // for Waveform visualizer
    const globalAnalyser = audioCtx.createAnalyser();
    globalGain.connect(globalAnalyser);
    draw();

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    var activeOscillators = {}
    var activeAdditiveOscs = {}
    var activeAMOscs = {}
    var activeFMOscs = {}
    var activeGains = {}
    var activeLFOs= {}

    function keyDown(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
            playNote(key);
        }
    }

    function keyUp(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && activeOscillators[key]) {
            // ADSR Release
            activeGains[key].gain.setTargetAtTime(0, audioCtx.currentTime, releaseConstant);

            delete activeOscillators[key];
            delete activeAdditiveOscs[key];
            delete activeAMOscs[key];
            delete activeFMOscs[key];
            delete activeGains[key];
            delete activeLFOs[key];
        }
    }

    function playNote(key) {
        synthType = document.querySelector('input[name="synthesis"]:checked').value
        waveformType = document.querySelector('input[name="waveform"]:checked').value
        var lfoOnNote = document.querySelector("input[id=isLFO]").checked

        console.log("lfoOnNote", lfoOnNote)
        if (synthType == "additive") {
            additivePlayNote(key, waveformType, lfoOnNote)
        } else if (synthType == "am") {
            console.log("AM BABY")
            AMPlayNote(key, waveformType, lfoOnNote);
        } else if (synthType == "fm") {
            console.log("FM BABY")
            FMPlayNote(key, waveformType, lfoOnNote);
        }
        else { // no synthesis, normal from hw 1
            normalPlayNote(key, waveformType, lfoOnNote)
        }
        
        // confetti for fun!
        confettiHelper(key, waveformType);
    }

    function gainAttackDecay() {
        // create gain 
        const gainNode = audioCtx.createGain();

        // active Osc
        var activeOscCount = Object.keys(activeOscillators).length + Object.keys(activeAMOscs).length + Object.keys(activeFMOscs).length;
        for (let k in activeAdditiveOscs) {
            activeOscCount += activeAdditiveOscs[k].length  
        }

        // adjust for active notes
        Object.values(activeGains).forEach(function (gainNode) {
            gainNode.gain.setTargetAtTime(attackMaxGain / activeOscCount, audioCtx.currentTime, epsilon);
        });

        // ADSR Attack
        gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gainNode.gain.setTargetAtTime(attackMaxGain / activeOscCount, audioCtx.currentTime, attackConstant);

        // ADSR Decay 
        gainNode.gain.setTargetAtTime(sustainGain / activeOscCount, audioCtx.currentTime + attackTime, decayConstant);
        
        return gainNode
    }

    function normalPlayNote(key, waveformType, isLFO) {
        var curFreq = keyboardFrequencyMap[key]
        var gainNode;
        
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(curFreq, audioCtx.currentTime);
        // choose your favorite waveform
        osc.type = waveformType;
        activeOscillators[key] = osc

        // create gain, ADSR A and D
        gainNode = gainAttackDecay()
        // // connect and start
        osc.connect(gainNode).connect(globalGain);
        osc.start();

        // LFO 
        if (isLFO == true) {
            addLFO(key, osc)
        }

        activeGains[key] = gainNode
    }

    function additivePlayNote(key, waveformType, isLFO) {
        var curFreq = keyboardFrequencyMap[key]
        var gainNode;
        
        // default osc
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(curFreq, audioCtx.currentTime);
        osc.type = waveformType;
        activeOscillators[key] = osc;

        var maxPartial = parseInt(document.getElementById("parSlider").value) + 1;
        var newOscs = [];

        // partial osc
        for (let i = 2; i < maxPartial; i++) {
            var curOsc = audioCtx.createOscillator();
            var randSign = Math.random() < 0.5 ? -1 : 1;
            var randPercent = parseInt(document.getElementById("randSlider").value)
            var additiveRandRange = curFreq * randPercent / 100
            curOsc.frequency.value = (i * curFreq) + randSign * Math.random() * additiveRandRange;
            curOsc.type = waveformType;
            newOscs.push(curOsc)
        } 
        activeAdditiveOscs[key] = newOscs;

        // create gain, ADSR A and D
        gainNode = gainAttackDecay()
        // // connect and start
        osc.connect(gainNode).connect(globalGain);
        osc.start();

        for (let i in newOscs) {
            // LFO
            // if (isLFO == true) {
            //     addLFO(key, newOscs[i])
            // }
            newOscs[i].connect(gainNode)
            newOscs[i].start();
        }

        // LFO 
        // if (isLFO == true) {
        //     addLFO(key, osc)
        // }

        activeGains[key] = gainNode
    }

    function AMPlayNote(key, waveformType, isLFO) {
        var curFreq = keyboardFrequencyMap[key]
        // TODO: how to set type here? on carrier or modulator or both...?
        var gainNode;

        var carrier = audioCtx.createOscillator();
        var modulatorFreq = audioCtx.createOscillator();

        modulatorFreq.type = waveformType;
        carrier.type = waveformType;
        modulatorFreq.frequency.value = parseInt(document.getElementById("MFSlider").value);
        carrier.frequency.value = curFreq;

        const modulated = audioCtx.createGain();
        const depth = audioCtx.createGain();
        depth.gain.value = 0.5 //scale modulator output to [-0.5, 0.5]
        modulated.gain.value = 1.0 - depth.gain.value; //a fixed value of 0.5

        activeOscillators[key] = carrier
        activeAMOscs[key] = modulatorFreq

        // create gain, ADSR A and D
        gainNode = gainAttackDecay()
    
        modulatorFreq.connect(depth).connect(modulated.gain); //.connect is additive, so with [-0.5,0.5] and 0.5, the modulated signal now has output gain at [0,1]
        carrier.connect(modulated)
        modulated.connect(gainNode);
        gainNode.connect(globalGain)
        
        carrier.start();
        modulatorFreq.start();

        // LFO 
        if (isLFO == true) {
            addLFO(key, carrier)
            addLFO(key, modulatorFreq)
        }

        activeGains[key] = gainNode
    }

    function FMPlayNote(key, waveformType, isLFO) { 
        var curFreq = keyboardFrequencyMap[key]
        // TODO: how to set type here? on carrier or modulator or both...?
        var gainNode;

        var carrier = audioCtx.createOscillator();
        var modulatorFreq = audioCtx.createOscillator();

        modulatorFreq.type = waveformType;
        carrier.type = waveformType;
        modulatorFreq.frequency.value = parseInt(document.getElementById("MFSlider").value);
        carrier.frequency.value = curFreq

        var modulationIndex = audioCtx.createGain();
        modulationIndex.gain.value = parseInt(document.getElementById("MISlider").value);

        activeOscillators[key] = carrier
        activeFMOscs[key] = modulatorFreq

        // create gain, ADSR A and D
        gainNode = gainAttackDecay()

        modulatorFreq.connect(modulationIndex);
        modulationIndex.connect(carrier.frequency)
        
        carrier.connect(gainNode);
        gainNode.connect(globalGain)
    
        carrier.start();
        modulatorFreq.start();

        // LFO 
        if (isLFO == true) {
            addLFO(key, carrier)
            addLFO(key, modulatorFreq)
        }

        activeGains[key] = gainNode
    }

    function addLFO(key, osc){
        console.log("in heree")
        var lfo = audioCtx.createOscillator();
        lfo.frequency.value = parseInt(document.getElementById("LFOFSlider").value);
        var lfoGain = audioCtx.createGain();
        lfoGain.gain.value = parseInt(document.getElementById("LFOGSlider").value);
        lfo.connect(lfoGain).connect(osc.frequency);
        lfo.start();

        if (key in activeLFOs){
            activeLFOs[key].push(lfo)
            console.log("activelfos key", activeLFOs[key])
        }
        else {
            console.log("activelfos key no prev")
            activeLFOs[key] = [lfo]
        }
            
    }

    // from prof's Waveform visualizer
    function draw() {
        globalAnalyser.fftSize = 2048;
        var bufferLength = globalAnalyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength);
        globalAnalyser.getByteTimeDomainData(dataArray);

        var canvas = document.querySelector("#globalVisualizer");
        var canvasCtx = canvas.getContext("2d");

        requestAnimationFrame(draw);

        globalAnalyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = "white";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "rgb(31,117,254)";

        canvasCtx.beginPath();

        var sliceWidth = canvas.width * 1.0 / bufferLength;
        var x = 0;

        for (var i = 0; i < bufferLength; i++) {
            var v = dataArray[i] / 128.0;
            var y = v * canvas.height / 2;
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }

})

// sliders and values

// show controls based on type
const synthRadioButtons = document.querySelectorAll('input[name="synthesis"]');
for(const radioButton of synthRadioButtons){
    radioButton.addEventListener('change', showSynthControls);
}    

// LFO 
let LFOcheckbox = document.querySelector("input[id=isLFO]");
LFOcheckbox.addEventListener('change', showLFOControls);

function showSynthControls(e) {
    const curSynth = this.value;
    // remove previous stuff inside (text, sliders, etc)
    synthControlsContainer.innerHTML = "";

    if (curSynth == "additive") {
        createSlider("Number of Partials: ", synthControlsContainer, "parSlider", 1, 10, 1, 5);
        createSlider("Percent of Randomness: ", synthControlsContainer, "randSlider", 0, 5, 0.5, 1);
    } else if (curSynth == "am") {
        createSlider("Modulation Frequency: ", synthControlsContainer, "MFSlider", 1, 1000, 1, 100);
    } else if (curSynth == "fm") {
        createSlider("Modulation Frequency: ", synthControlsContainer, "MFSlider", 1, 1000, 1, 100);
        createSlider("Modulation Index: ", synthControlsContainer, "MISlider", 1, 1000, 1, 100);
    }
}

function showLFOControls(e) {
    const isLFO = this.checked;
    // remove previous stuff inside (text, sliders, etc)
    lfoSliderContainer.innerHTML = "";
    
    // If the checkbox is checked, display the LFO sliders
    if (isLFO == true){
        createSlider("LFO Frequency: ", lfoSliderContainer, "LFOFSlider", 0, 5, 0.5, 1);
        createSlider("Modulation Index: ", lfoSliderContainer, "LFOGSlider", 0, 10, 1, 8);
    } 
}

function createSlider(labelText, container, id, minVal, maxVal, step, value) { 
    // Create label for the slider
    // const label = document.createElement("label");
    // label.textContent = labelText;
    const label = document.createElement("p");
    label.innerText = labelText;
    container.appendChild(label);

    // Create slider
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = minVal;
    slider.max = maxVal;
    slider.value = value; 
    slider.step = step
    slider.id = id;
    container.appendChild(slider);

    // Create span element to display the selected value
    const valueOutput = document.createElement("span");
    valueOutput.id = "sliderValue";
    valueOutput.textContent = " " + slider.value;
    container.appendChild(valueOutput);

    // Update value in span when slider changed
    slider.addEventListener("input", function () {
        valueOutput.textContent = " " + slider.value;
  });

}