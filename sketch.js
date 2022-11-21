const SEQ_LEN = 32;
const SEQ_OCT = 3;

const TEMPO_MIN = 50;
const TEMPO_MAX = 450

const world_width = SEQ_LEN;
const world_height = 12 * SEQ_OCT;

const neighbour_vecs = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

let stage = Array.from(Array(world_width), () => new Array(world_height));

function setup() {
  var canvas = createCanvas(...calcSize());
  canvas.parent('world');

  // AUdio Setup
  reverb = new p5.Reverb();
  reverb.drywet(0.4);
  polySynth = new p5.PolySynth(p5.MonoSynth, world_height * 3);
  polySynth.setADSR(0.1, 0.1);
  polySynth.disconnect();
  reverb.process(polySynth, 3, 2);
  fft = new p5.FFT();

  // GUI
  button = select("#start");
  button.mousePressed(toggleSequencer);
  
  // BPM
  tempo = select("#tempo");
  
  // SEED
  seed = select("#seed");
  seed.input(updateSeed);

  // ROOT
  rootSel = select("#rootNote")
  M_NOTES.forEach((n) => rootSel.option(n));
  rootSel.changed(switchScale);
  
  // SCALE
  scaleSel = select("#selectedScale")
  M_PRESET.forEach((s, i) => {
    scaleSel.option(`${s.Name} (${s.Group})`, i);
  });
  scaleSel.changed(switchScale);
  
  // GET QUERY PARAM
  hashValue = window.location.hash;

  // PROVISION WITH SEED
  seed.value(hashValue != "" ? parseInt(hashValue.substring(1)) : ceil(random(0, 9999)));
  randomSeed(seed.value());
  tempo.value(ceil(random(TEMPO_MIN, TEMPO_MAX)))
  rootSel.selected(M_NOTES[floor(random(0, M_NOTES.length))]);
  scaleSel.selected(floor(random(0, M_PRESET.length)));
  switchScale();
  makeSequence(seed.value());
  
  // Share Link
  //window.location.hash = `#${seed.value()}`;
  trackTitle = select("#songTitle");
  trackTitle.elt.innerText = `No ${seed.value()} in ${rootSel.value()} (${M_PRESET[scaleSel.value()].Name})`;
  trackTitle.elt.href = `#${seed.value()}`;
}

function switchScale() {
  playScale = makeFullScale(
    rootSel.value(),
    M_PRESET[scaleSel.value()].Value,
    SEQ_OCT * 2
  );
}

function updateSeed() {
  if (seqRunning) toggleSequencer();
  makeSequence(this.value());
}

function mouseClicked(event) {
    toggleSequencer();
  // if (mouseX < 0 || mouseY < 0) return false;
  // cell_x = floor(map(mouseX, 0, width, 0, world_width));
  // cell_y = floor(map(mouseY, 0, height, 0, world_height));
  // stage[cell_x][cell_y] = !stage[cell_x][cell_y];
  // return true;
}

function makeSequence(seed) {
  step = 0;
  if (seed == 0) {
    stage = Array.from(Array(world_width), () => new Array(world_height));
    return;
  }
  for (let x = 0; x < world_width; x++) {
    for (let y = 0; y < world_height; y++) {
      stage[x][y] = round(random(1)) == 1;
    }
  }
}

function getNeighbourCount(x, y) {
  let count = 0;
  for (let i = 0; i < neighbour_vecs.length; i++) {
    const vec = neighbour_vecs[i];
    const cur = [x + vec[0], y + vec[1]];
    if (cur[0] < 0 || cur[0] >= world_width) continue;
    if (cur[1] < 0 || cur[1] >= world_height) continue;
    if (stage[cur[0]][cur[1]] == true) count++;
  }
  return count;
}

function compute() {
  let nextStage = Array.from(Array(world_width), () => new Array(world_height));
  for (let x = 0; x < world_width; x++) {
    for (let y = 0; y < world_height; y++) {
      const cur = stage[x][y] == true;
      const count = getNeighbourCount(x, y);

      if (cur & (count == 2 || count == 3)) {
        nextStage[x][y] = true;
      } else if (!cur & (count == 3)) {
        nextStage[x][y] = true;
      } else {
        nextStage[x][y] = false;
      }
    }
  }
  stage = nextStage;
}

function toggleSequencer() {
  if (seqRunning) {
    step = 0;
  } else {
    userStartAudio();
  }
  seqRunning = !seqRunning;
}

function triggerSynth() {
  for (let y = 0; y < world_height; y++) {
    if (stage[step][y] != true) continue;
    note = playScale[y];
    polySynth.play(note, 0.8, 0, 0.2);
  }
}

let seqRunning = false;
let lastUpdated = 0;
let step = 0;
let playScale = null;

function draw() {
  // Wrap around step
  if (step >= world_width) step = 0;

  // Processing
  const delayTime = 60000 / tempo.value();
  if (millis() > lastUpdated + delayTime && seqRunning) {
    lastUpdated = millis();
    triggerSynth();
    compute();
    step++;
  }

  background(color("#FEFEFE"));

  // Waveform
  noFill();
  stroke(color("red"));
  let wave = fft.waveform();
  beginShape();
  strokeWeight(2);
  for (let i = 0; i < wave.length; i++) {
    let x = map(i, 0, wave.length, 0, width);
    let y = map(wave[i], -1, 1, height, 0);
    vertex(x, y);
  }
  endShape();

  // Draw World
  fill(color("#385E72"));
  noStroke();
  for (let x = 0; x < world_width; x++) {
    for (let y = 0; y < world_height; y++) {
      if (stage[x][y] != true) continue;
      fill(x == step - 1 ? color("#6AABD2") : color("#385E72"));
      cell_x = map(x, 0, world_width, 0, width);
      cell_y = map(y, 0, world_height, 0, height);
      rect(cell_x, cell_y, width / world_width, height / world_height);
    }
  }

  // Draw Sequencer Window
  if (seqRunning) {
    stroke(color("#6AABD2"));
    noFill();
    strokeWeight(1);
    win_start = map(step - 1, 0, world_width, 0, width);
    rect(win_start, 0, width / world_width, height);
  } else {
      fill(color(255, 220));
      rect(0, 0, width, height);
      fill(color(0));
      textSize(32);
      textAlign(CENTER, CENTER);
      text('TAP TO START', width/2, height/2);
  }
}

function windowResized() {
  resizeCanvas(...calcSize());
}

function calcSize() {
  const seqRatio = calculateRatio(world_width, world_height);
  const sizeRoot = windowWidth < windowHeight ? windowWidth : windowHeight;
  const deviser = 1.3;
  return [
    (sizeRoot / deviser) * (seqRatio[0] / 10),
    (sizeRoot / deviser) * (seqRatio[1] / 10),
  ];
}

function calculateRatio(num_1, num_2) {
  for (num = num_2; num > 1; num--) {
    if (num_1 % num == 0 && num_2 % num == 0) {
      num_1 = num_1 / num;
      num_2 = num_2 / num;
    }
  }
  return [num_1, num_2];
}
