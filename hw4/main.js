
var audioCtx;
var osc;
var timings;
var liveCodeState = [];
const playButton = document.querySelector('button');

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)
    osc = audioCtx.createOscillator();
    timings = audioCtx.createGain();
    timings.gain.value = 0;
    osc.connect(timings).connect(audioCtx.destination);
    osc.start();
    scheduleAudio()
}

function scheduleAudio() {
    let timeElapsedSecs = 0;
    liveCodeState.forEach(noteData => {
        // have a rest for specified length
        console.log("amp", noteData["amp"])
        if (noteData["pitch"] === 0) {
            timeElapsedSecs += noteData["length"]/10.0 + 0.2;
        }
        else {
            timings.gain.setTargetAtTime(noteData["amp"], audioCtx.currentTime + timeElapsedSecs, 0.01)
            osc.frequency.setTargetAtTime(noteData["pitch"], audioCtx.currentTime + timeElapsedSecs, 0.01)
            timeElapsedSecs += noteData["length"]/10.0;
            timings.gain.setTargetAtTime(0, audioCtx.currentTime + timeElapsedSecs, 0.01)
            timeElapsedSecs += 0.2; //rest between notes
        }
    });
    setTimeout(scheduleAudio, timeElapsedSecs * 1000);
}

function parseCode(code) {
    //how could we allow for a repeat operation 
    //(e.g. "3@340 2[1@220 2@330]"" plays as "3@340 1@220 2@330 1@220 2@330")
    //how could we allow for two lines that play at the same time?
    //what if we want variables?
    //how does this parsing technique limit us?
    let notes = code.split(" ");

    // set osc type
    if (['sine', 'square', 'triangle', 'triangle'].includes(notes[0])) {
        osc.type = notes[0]
        console.log("type", osc.type);
        notes = notes.slice(1)
    }
    else {
        osc.type = 'sine'
    }

    //notice this will fail if the input is not correct
    //how could you handle this? allow some flexibility in the grammar? fail gracefully?
    //ideally (probably), the music does not stop
    notes = notes.map(note => {
        noteData = note.split("@");
        return   {"length" : eval(noteData[0]), //the 'eval' function allows us to write js code in our live coding language
                "pitch" : eval(noteData[1]),
                "amp": eval(noteData[2]) <= 1 && eval(noteData[2]) >= 0 ? eval(noteData[2]) : 0.75}
                //what other things should be controlled? osc type? synthesis technique?
    });
    return notes;
}

function genAudio(data) {
    liveCodeState = data;
}

function reevaluate() {
    var code = document.getElementById('code').value;
    var data = parseCode(code);
    genAudio(data);
}

playButton.addEventListener('click', function () {

    if (!audioCtx) {
        initAudio();
    }

    reevaluate();


});
