// soundStrider Random Ambience Generator
// HRTF 3D spatial audio with procedural synthesis

let ctx = null;
let masterGain = null;
let masterFilter = null;
let compressor = null;
let convolver = null;
let dryGain = null;
let wetGain = null;
let reverbPreDelay = null;
let reverbHP = null;
let reverbLP = null;
let delayNode = null;
let delayFeedback = null;
let delayFilter = null;
let delayWet = null;
let isPlaying = false;
let animFrameId = null;

// All active spatial sound sources for position updates
let spatialSources = [];

// Active layer references
let activeLayers = { wind: null, drone: null, texture: null, tone: null, props: null, arpeggio: null, rhythm: null, pad: null, highway: null, melodicArp: null, chordal: null, polyrhythm: null, trance: null, urban: null, lofi: null, berlin: null, dub: null, forestSonata: null, tundraSonata: null, stormSonata: null, astralSonata: null, totalSonata: null };

// Urban vehicle state
let urbanVehicles = [];

// Evolution timer
let evolutionTimer = null;

// Auto-switch timer
let autoSwitchTimeout = null;
let autoSwitchSeconds = 0;

// Evolve transition mode
let evolveTransition = false;

// Selected world: 'random', 'mixed', or a specific world name
let selectedWorld = 'random';

// Conductor — pinned entities never despawn; banned ones are skipped/killed
const pinnedEntities = new Set();
const bannedEntities = new Set();

// Generation overrides — when not 'random', Regenerate uses these instead of randomizing
let selectedKey = 'random';   // 'random' or one of NOTE_NAMES
let selectedScale = 'random'; // 'random' or a key into SCALES_BY_ID
let selectedBpm = 'random';   // 'random' or a numeric string

const SCALES_BY_ID = {
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    majorPent:  [0, 2, 4, 7, 9, 12],
    minorPent:  [0, 3, 5, 7, 10, 12],
    majorBlues: [0, 2, 3, 4, 7, 9, 12],
    minorBlues: [0, 3, 5, 6, 7, 10, 12],
    wholeTone:  [0, 2, 4, 6, 8, 10, 12],
    hirajoshi:  [0, 2, 3, 7, 8, 12],
    in:         [0, 1, 5, 7, 8, 12],
    iwato:      [0, 1, 5, 6, 10, 12],
    insen:      [0, 1, 5, 7, 10, 12],
    yo:         [0, 2, 5, 7, 9, 12],
    kumoi:      [0, 2, 3, 7, 9, 12],
    ryukyu:     [0, 4, 5, 7, 11, 12]
};

function resetGenerationSettings() {
    selectedKey = 'random';
    selectedScale = 'random';
    selectedBpm = 'random';
    const k = document.getElementById('keySelect');
    const s = document.getElementById('scaleSelect');
    const t = document.getElementById('tempoSelect');
    if (k) k.value = 'random';
    if (s) s.value = 'random';
    if (t) t.value = 'random';
}

// Current randomized parameters
let params = {
    volume: 0.7,
    density: 0.5,
    movement: 0.5,
    reverb: 0.5,
    brightness: 0.5,
    depth: 0.6,
    filterCutoff: 0.8,
    modSpeed: 0.4,
    entityCount: 5,
    flyRate: 0.5,
    layerVolumes: {
        wind: 1.0, drone: 1.0, texture: 1.0, tone: 1.0,
        arpeggio: 1.0, rhythm: 1.0, props: 1.0,
        pad: 1.0, highway: 1.0, melodicArp: 1.0, chordal: 1.0, polyrhythm: 1.0,
        trance: 1.0, urban: 1.0, lofi: 1.0, berlin: 1.0, dub: 1.0,
        forestSonata: 1.0, tundraSonata: 1.0, stormSonata: 1.0, astralSonata: 1.0, totalSonata: 1.0
    }
};

// Current blend recipe
let recipe = null;

// ========== SPECIMEN NAME GENERATOR ==========

const _latin = {
    // Real Latin words — the "seasoning"
    real: [
        'Lacus','Ignis','Ventus','Caelum','Spiritus','Fractus','Noctis','Aether',
        'Umbra','Lumen','Sonus','Tempus','Aqua','Terra','Sidus','Vortex',
        'Magnus','Novus','Aeneus','Decorus','Vastus','Bellum','Pecunia',
        'Effectus','Relevo','Omitto','Impudens','Temeritas','Accusator',
        'Opportunitas','Carnutum','Aestus','Attero','Campana','Tinnitus',
        'Obscurus','Profundus','Silentium','Resonare','Cadentia','Fulgor',
        'Nebula','Glacies','Pulsus','Cursus','Vertigo','Ferrum','Crystallum',
        'Perpetuum','Somnium','Incendium','Velox','Phantasma','Requiem',
        'Sanctus','Abyssus','Aureum','Oceanus','Tremor','Peregrinus'
    ],
    // Syllable building blocks for procedural "dog Latin"
    prefixes: [
        'pre','pro','noc','sub','con','trans','per','ob','ex','in',
        'de','re','ab','ad','inter','super','ultra','semi','quasi','prae'
    ],
    roots: [
        'uder','ment','bell','morph','cand','lumin','terr','aquil','font',
        'puls','vect','grav','son','carn','ven','rupt','flux','templ',
        'stell','nebb','cryst','volt','fract','umbr','sider','veloc',
        'phant','somn','glaci','fulg','reson','trem','nebul','cadul',
        'spir','anim','vigor','prism','harmon','oscill'
    ],
    suffixes: [
        'us','um','is','ous','itas','ium','ax','or','ens','alis',
        'eus','inus','atus','ulus','ellum','andus','oris','ix','untis','icum'
    ],
    // Connecting vowels for smoother syllable joins
    connectors: ['i','u','a','e','o']
};

function _randEl(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateDogLatinWord() {
    // Build a procedural gibberish word from syllable parts
    const prefix = _randEl(_latin.prefixes);
    const root = _randEl(_latin.roots);
    const suffix = _randEl(_latin.suffixes);

    // Sometimes add a connector vowel between prefix and root for flow
    let word;
    const lastCharPrefix = prefix[prefix.length - 1];
    const firstCharRoot = root[0];
    const bothConsonants = !'aeiou'.includes(lastCharPrefix) && !'aeiou'.includes(firstCharRoot);

    if (bothConsonants && Math.random() < 0.6) {
        word = prefix + _randEl(_latin.connectors) + root + suffix;
    } else {
        word = prefix + root + suffix;
    }

    // Capitalize first letter
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function generateSpecimenName() {
    const roll = Math.random();

    let name;
    if (roll < 0.1) {
        // 10%: single word (real or gibberish)
        name = Math.random() < 0.5 ? _randEl(_latin.real) : generateDogLatinWord();
    } else if (roll < 0.3) {
        // 20%: two real Latin words
        const a = _randEl(_latin.real);
        let b = _randEl(_latin.real);
        while (b === a) b = _randEl(_latin.real);
        name = a + ' ' + b;
    } else if (roll < 0.6) {
        // 30%: one real + one gibberish (either order)
        if (Math.random() < 0.5) {
            name = _randEl(_latin.real) + ' ' + generateDogLatinWord();
        } else {
            name = generateDogLatinWord() + ' ' + _randEl(_latin.real);
        }
    } else {
        // 40%: two procedural gibberish words
        name = generateDogLatinWord() + ' ' + generateDogLatinWord();
    }

    return name;
}

function displaySpecimenName() {
    const el = document.getElementById('specimenName');
    const keyEl = document.getElementById('specimenKey');
    // Fade out
    el.className = 'name-text';
    if (keyEl) keyEl.className = 'key-text';
    setTimeout(() => {
        el.textContent = generateSpecimenName();
        el.className = 'name-text visible';
        if (keyEl && recipe) {
            keyEl.textContent = recipe.keyName + ' ' + recipe.scaleName;
            keyEl.className = 'key-text visible';
        }
    }, 150);
}

// ========== WORLD DATA ==========

const WORLDS = {
    aquatic: {
        name: 'Aquatic', color: '#1a7fa0',
        baseFreq: 70, windSpeed: 0.15, windIntensity: 0.1,
        droneFreqs: [35, 52.5, 70, 105],
        textureType: 'bubbles', toneScale: [0, 2, 4, 6, 8, 10],
        filterBase: 500, reverbDecay: 6,
        props: ['dolphin', 'whale', 'sonar', 'submarine', 'glitter', 'barracuda', 'clam', 'aquatic_ripple'],
        arpScale: [0, 2, 4, 6, 8, 10], arpSpeed: 0.2
    },
    astral: {
        name: 'Astral', color: '#6644aa',
        baseFreq: 55, windSpeed: 0.05, windIntensity: 0,
        droneFreqs: [27.5, 55, 110, 165],
        textureType: 'shimmer', toneScale: [0, 3, 6, 9, 12],
        filterBase: 2000, reverbDecay: 9,
        props: ['pulsar', 'comet', 'aurora', 'celestial', 'starfield', 'astral_dust', 'astral_terrestrial'],
        arpScale: [0, 3, 6, 9, 12], arpSpeed: 0.25
    },
    beach: {
        name: 'Beach', color: '#1a6b8a',
        baseFreq: 80, windSpeed: 0.5, windIntensity: 0.6,
        droneFreqs: [40, 60, 80],
        textureType: 'waves', toneScale: [0, 2, 4, 7, 9, 12],
        filterBase: 600, reverbDecay: 4,
        props: ['seagull', 'foghorn', 'buoy', 'tide', 'crab', 'beach_wave'],
        arpScale: [0, 2, 4, 7, 9, 12], arpSpeed: 0.2
    },
    classic: {
        name: 'Classic', color: '#aa6622',
        baseFreq: 110, windSpeed: 0.3, windIntensity: 0.4,
        droneFreqs: [55, 82.5, 110, 165],
        textureType: 'leaves', toneScale: [0, 2, 4, 5, 7, 9, 11],
        filterBase: 800, reverbDecay: 3,
        props: ['classic_bugger', 'classic_campfire', 'classic_oinker', 'classic_subwoofer', 'classic_tweeter', 'classic_waterfall', 'bird', 'frog'],
        arpScale: [0, 2, 4, 5, 7, 9, 11], arpSpeed: 0.3
    },
    desert: {
        name: 'Desert', color: '#c4a35a',
        baseFreq: 150, windSpeed: 0.2, windIntensity: 0.3,
        droneFreqs: [65, 97.5, 130],
        textureType: 'sand', toneScale: [0, 2, 3, 5, 7, 10],
        filterBase: 1200, reverbDecay: 6,
        props: ['rattlesnake', 'vulture', 'geyser', 'mirage', 'scorpion', 'swarm', 'desert_dune', 'desert_sidewinder'],
        arpScale: [0, 2, 3, 7, 10, 12], arpSpeed: 0.15
    },
    elemental: {
        name: 'Elemental', color: '#eeeeff',
        baseFreq: 220, windSpeed: 0.05, windIntensity: 0,
        droneFreqs: [110, 220, 330, 440],
        textureType: 'shimmer', toneScale: [0, 2, 4, 5, 7, 9, 11],
        filterBase: 2000, reverbDecay: 5,
        props: ['elemental_tone', 'elemental_overtone', 'elemental_spectre', 'elemental_dither', 'elemental_tremolo', 'elemental_vibrato', 'crystal_bell'],
        arpScale: [0, 2, 4, 5, 7, 9, 11], arpSpeed: 0.35
    },
    forest: {
        name: 'Forest', color: '#2d5a27',
        baseFreq: 120, windSpeed: 0.3, windIntensity: 0.4,
        droneFreqs: [55, 82.5, 110],
        textureType: 'leaves', toneScale: [0, 3, 5, 7, 10, 12],
        filterBase: 800, reverbDecay: 3,
        props: ['bird', 'cicada', 'frog', 'canopy', 'owl', 'forest_ape', 'forest_jaguar', 'wind_voice', 'music_box'],
        arpScale: [0, 3, 7, 10, 12, 15], arpSpeed: 0.3
    },
    industrial: {
        name: 'Industrial', color: '#5a4a3a',
        baseFreq: 50, windSpeed: 0.1, windIntensity: 0.2,
        droneFreqs: [25, 50, 75, 100],
        textureType: 'machine', toneScale: [0, 1, 4, 5, 8, 11],
        filterBase: 600, reverbDecay: 3,
        props: ['piston', 'conveyor', 'generator', 'tesla', 'alarm', 'metal_groan', 'industrial_ground', 'fast_staccato'],
        arpScale: [0, 1, 5, 6, 8, 11], arpSpeed: 0.5
    },
    limbic: {
        name: 'Limbic', color: '#aa3344',
        baseFreq: 60, windSpeed: 0.05, windIntensity: 0,
        droneFreqs: [30, 60, 90, 120],
        textureType: 'crackle', toneScale: [0, 2, 4, 7, 9],
        filterBase: 400, reverbDecay: 2,
        props: ['limbic_heart', 'limbic_larynx', 'limbic_lung', 'limbic_nerve', 'limbic_vessel'],
        arpScale: [0, 2, 4, 7, 9], arpSpeed: 0.4
    },
    mainframe: {
        name: 'Mainframe', color: '#44aa88',
        baseFreq: 100, windSpeed: 0.05, windIntensity: 0,
        droneFreqs: [50, 100, 150, 200],
        textureType: 'hum', toneScale: [0, 2, 4, 5, 7, 9, 11],
        filterBase: 1500, reverbDecay: 2,
        props: ['mainframe_keyboard', 'mainframe_modem', 'mainframe_display', 'mainframe_tape', 'mainframe_widget', 'mainframe_super'],
        arpScale: [0, 2, 4, 5, 7, 9, 11], arpSpeed: 0.45
    },
    mountain: {
        name: 'Mountain', color: '#5a6a7a',
        baseFreq: 100, windSpeed: 0.6, windIntensity: 0.5,
        droneFreqs: [50, 75, 100, 150],
        textureType: 'wind', toneScale: [0, 2, 4, 5, 7, 9, 11],
        filterBase: 700, reverbDecay: 7,
        props: ['chimes', 'bowl', 'eagle', 'rockfall', 'goat', 'mountain_gust', 'mountain_quake', 'crystal_bell', 'note_flurry'],
        arpScale: [0, 4, 7, 11, 12, 16], arpSpeed: 0.25
    },
    pulse: {
        name: 'Pulse', color: '#cc44cc',
        baseFreq: 80, windSpeed: 0.05, windIntensity: 0,
        droneFreqs: [40, 80, 120, 160],
        textureType: 'electric', toneScale: [0, 2, 4, 7, 9],
        filterBase: 1200, reverbDecay: 4,
        props: ['pulse_grain', 'pulse_grain', 'pulse_grain', 'pulse_grain', 'fast_staccato', 'note_flurry'],
        arpScale: [0, 2, 4, 7, 9], arpSpeed: 0.4
    },
    storm: {
        name: 'Storm', color: '#3a3a5a',
        baseFreq: 60, windSpeed: 0.8, windIntensity: 0.9,
        droneFreqs: [30, 45, 60, 90],
        textureType: 'rain', toneScale: [0, 1, 5, 6, 10, 11],
        filterBase: 400, reverbDecay: 5,
        props: ['thunder', 'lightning', 'downpour', 'roll', 'deep_horn'],
        arpScale: [0, 1, 5, 6, 10, 11], arpSpeed: 0.5
    },
    trance: {
        name: 'Trance', color: '#FF00AA',
        baseFreq: 110, windSpeed: 0, windIntensity: 0,
        droneFreqs: [55, 110, 165, 220],
        textureType: 'electric', toneScale: [0, 2, 4, 7, 9, 12],
        filterBase: 1000, reverbDecay: 2,
        props: [], specialSystem: 'trance',
        arpScale: [0, 2, 4, 7, 9, 12], arpSpeed: 0.5
    },
    tundra: {
        name: 'Tundra', color: '#a0c0d0',
        baseFreq: 130, windSpeed: 0.7, windIntensity: 0.6,
        droneFreqs: [65, 97.5, 130],
        textureType: 'ice', toneScale: [0, 2, 5, 7, 9, 12],
        filterBase: 1000, reverbDecay: 9,
        props: ['wolf', 'glacier', 'blizzard', 'frost', 'aurora', 'tundra_hare', 'tundra_ox', 'tundra_snow'],
        arpScale: [0, 2, 7, 9, 12, 14], arpSpeed: 0.2
    },
    urban: {
        name: 'Urban', color: '#888899',
        baseFreq: 90, windSpeed: 0.25, windIntensity: 0.2,
        droneFreqs: [45, 60, 90, 120],
        textureType: 'hum', toneScale: [0, 2, 5, 7, 10, 12],
        filterBase: 900, reverbDecay: 2,
        props: [], specialSystem: 'urban',
        arpScale: [0, 3, 5, 7, 10, 12], arpSpeed: 0.4
    },
    lofi: {
        name: 'Lo-Fi', color: '#d4a373',
        baseFreq: 110, windSpeed: 0, windIntensity: 0,
        droneFreqs: [55, 82.5, 110],
        textureType: 'crackle', toneScale: [0, 2, 3, 5, 7, 8, 10],
        filterBase: 1800, reverbDecay: 3.5,
        props: [], specialSystem: 'lofi',
        arpScale: [0, 3, 5, 7, 10, 12], arpSpeed: 0.3
    },
    berlin: {
        name: 'Berlin School', color: '#7aa2f7',
        baseFreq: 110, windSpeed: 0, windIntensity: 0,
        droneFreqs: [55, 82.5, 110, 165],
        textureType: 'electric', toneScale: [0, 2, 3, 5, 7, 8, 10],
        filterBase: 1200, reverbDecay: 6,
        props: [], specialSystem: 'berlin',
        arpScale: [0, 2, 3, 5, 7, 8, 10, 12], arpSpeed: 0.2
    },
    dub: {
        name: 'Dub', color: '#3aa856',
        baseFreq: 82, windSpeed: 0, windIntensity: 0,
        droneFreqs: [41, 55, 82],
        textureType: 'hum', toneScale: [0, 2, 4, 5, 7, 9, 11],
        filterBase: 700, reverbDecay: 4.5,
        props: [], specialSystem: 'dub',
        arpScale: [0, 2, 4, 7, 9, 12], arpSpeed: 0.4
    },
    forestSonata: {
        name: 'Forest Sonata', color: '#5a9a4a',
        baseFreq: 110, windSpeed: 0.2, windIntensity: 0.15,
        droneFreqs: [55, 82.5, 110],
        textureType: 'leaves', toneScale: [0, 2, 4, 7, 9, 11],
        filterBase: 1200, reverbDecay: 4.5,
        props: [], specialSystem: 'forestSonata',
        arpScale: [0, 2, 4, 7, 9, 12], arpSpeed: 0.3
    },
    tundraSonata: {
        name: 'Tundra Sonata', color: '#a0c8e0',
        baseFreq: 130, windSpeed: 0.4, windIntensity: 0.3,
        droneFreqs: [65, 97.5, 130],
        textureType: 'ice', toneScale: [0, 2, 5, 7, 9, 12],
        filterBase: 1400, reverbDecay: 8,
        props: [], specialSystem: 'tundraSonata',
        arpScale: [0, 2, 7, 9, 12, 14], arpSpeed: 0.25
    },
    astralSonata: {
        name: 'Astral Sonata', color: '#9966ff',
        baseFreq: 110, windSpeed: 0, windIntensity: 0,
        droneFreqs: [55, 82.5, 110],
        textureType: 'shimmer', toneScale: [0, 2, 4, 7, 9, 12],
        filterBase: 1500, reverbDecay: 9,
        props: [], specialSystem: 'astralSonata',
        arpScale: [0, 2, 4, 7, 9, 12, 16], arpSpeed: 0.2
    },
    stormSonata: {
        name: 'Storm Sonata', color: '#7060a0',
        baseFreq: 100, windSpeed: 0.5, windIntensity: 0.45,
        droneFreqs: [50, 75, 100],
        textureType: 'rain', toneScale: [0, 2, 3, 5, 7, 8, 10],
        filterBase: 600, reverbDecay: 5,
        props: [], specialSystem: 'stormSonata',
        arpScale: [0, 3, 5, 7, 10, 12], arpSpeed: 0.4
    },
    totalSonata: {
        name: 'Total Sonata', color: '#ff6ec7',
        baseFreq: 110, windSpeed: 0, windIntensity: 0,
        droneFreqs: [55, 82.5, 110],
        textureType: 'leaves', toneScale: [0, 2, 4, 7, 9, 11],
        filterBase: 1200, reverbDecay: 5,
        props: [], specialSystem: 'totalSonata',
        arpScale: [0, 2, 4, 7, 9, 12], arpSpeed: 0.3
    }
};

// ========== AUDIO INIT ==========

function initAudio() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Set listener at origin facing forward
    const L = ctx.listener;
    if (L.positionX) {
        L.positionX.value = 0; L.positionY.value = 0; L.positionZ.value = 0;
        L.forwardX.value = 0; L.forwardY.value = 0; L.forwardZ.value = -1;
        L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
        L.setPosition(0, 0, 0);
        L.setOrientation(0, 0, -1, 0, 1, 0);
    }

    masterGain = ctx.createGain();
    masterGain.gain.value = 0; // Start at 0 for fade-in

    masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.value = 200 + params.filterCutoff * 19800;
    masterFilter.Q.value = 0.5;

    // Compressor/limiter to prevent clipping
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 6;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    // Reverb chain: pre-delay → convolver → HP → LP → wetGain
    convolver = ctx.createConvolver();
    reverbPreDelay = ctx.createDelay(0.1);
    reverbPreDelay.delayTime.value = 0.025;
    reverbHP = ctx.createBiquadFilter();
    reverbHP.type = 'highpass';
    reverbHP.frequency.value = 100;
    reverbHP.Q.value = 0.7;
    reverbLP = ctx.createBiquadFilter();
    reverbLP.type = 'lowpass';
    reverbLP.frequency.value = 8000;
    reverbLP.Q.value = 0.7;

    // Feedback delay: delay → filter → feedback loop + wet out
    delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.value = 0.4 + Math.random() * 0.4;
    delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.35;
    delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 3000;
    delayFilter.Q.value = 0.5;
    delayWet = ctx.createGain();
    delayWet.gain.value = 0.18;

    dryGain = ctx.createGain();
    wetGain = ctx.createGain();
    dryGain.gain.value = 1 - params.reverb * 0.6;
    wetGain.gain.value = params.reverb * 0.6;

    // Signal chain:
    // masterGain → masterFilter → compressor → dryGain → destination
    //                                        → reverbPreDelay → convolver → reverbHP → reverbLP → wetGain → destination
    //                                        → delayNode → delayFilter → delayWet → destination
    //                                                    → delayFeedback → delayNode (loop)
    masterGain.connect(masterFilter);
    masterFilter.connect(compressor);

    // Dry path
    compressor.connect(dryGain);
    dryGain.connect(ctx.destination);

    // Reverb path
    compressor.connect(reverbPreDelay);
    reverbPreDelay.connect(convolver);
    convolver.connect(reverbHP);
    reverbHP.connect(reverbLP);
    reverbLP.connect(wetGain);
    wetGain.connect(ctx.destination);

    // Delay path
    compressor.connect(delayNode);
    delayNode.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delayNode); // feedback loop
    delayFilter.connect(delayWet);
    delayWet.connect(ctx.destination);
}

function createReverbImpulse(decay) {
    const rate = ctx.sampleRate;
    const len = rate * Math.min(decay, 10);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            const t = i / len;
            // Exponential decay (power 3.5) for more natural reverb tail
            const envelope = Math.pow(1 - t, 3.5);
            // Add early reflections spike in first 5%
            const early = t < 0.05 ? (1 + 2 * (1 - t / 0.05)) : 1;
            d[i] = (Math.random() * 2 - 1) * envelope * early;
        }
    }
    convolver.buffer = buf;
}

// ========== NOISE BUFFERS ==========

const noiseCache = {};

function createNoiseBuffer(type, duration) {
    const key = type + '_' + duration;
    if (noiseCache[key]) return noiseCache[key];

    const rate = ctx.sampleRate;
    const len = rate * duration;
    const buf = ctx.createBuffer(2, len, rate);

    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            if (type === 'white') { d[i] = w; }
            else { d[i] = (last + 0.02 * w) / 1.02; last = d[i]; d[i] *= 3.5; }
        }
    }
    noiseCache[key] = buf;
    return buf;
}

// ========== WAVESHAPER ==========

function createWarmShaper(drive) {
    drive = drive || 2.0;
    const shaper = ctx.createWaveShaper();
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = Math.tanh(x * drive);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    return shaper;
}

// ========== SYNTH HELPERS ==========

function synthSimple(freq, type, when, dur, out) {
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.2, when + Math.min(dur * 0.1, 0.05));
    env.gain.setValueAtTime(0.2, when + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(env);
    if (out) env.connect(out);
    osc.start(when);
    osc.stop(when + dur);
    return { osc, env, output: env };
}

function synthFM(freq, modFreq, modDepth, type, when, dur, out) {
    const carrier = ctx.createOscillator();
    carrier.type = type || 'sine';
    carrier.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = modFreq;
    const modGain = ctx.createGain();
    modGain.gain.value = modDepth;
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.2, when + Math.min(dur * 0.15, 0.1));
    env.gain.setValueAtTime(0.2, when + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    carrier.connect(env);
    if (out) env.connect(out);
    carrier.start(when);
    mod.start(when);
    carrier.stop(when + dur);
    mod.stop(when + dur);
    return { carrier, mod, modGain, env, output: env };
}

function synthAM(freq, modFreq, modDepth, type, when, dur, out) {
    const carrier = ctx.createOscillator();
    carrier.type = type || 'sine';
    carrier.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = modFreq;
    const modGain = ctx.createGain();
    modGain.gain.value = modDepth;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.2, when + Math.min(dur * 0.15, 0.1));
    env.gain.setValueAtTime(0.2, when + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    mod.connect(modGain);
    modGain.connect(env.gain);
    carrier.connect(env);
    if (out) env.connect(out);
    carrier.start(when);
    mod.start(when);
    carrier.stop(when + dur);
    mod.stop(when + dur);
    return { carrier, mod, modGain, env, output: env };
}

// ========== HRTF PANNER FACTORY ==========

function createHRTF(x, y, z) {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 4;
    p.maxDistance = 60;
    p.rolloffFactor = 0.6;
    p.coneInnerAngle = 360;
    p.coneOuterAngle = 360;
    p.coneOuterGain = 1;
    if (p.positionX) {
        p.positionX.value = x || 0;
        p.positionY.value = y || 0;
        p.positionZ.value = z || 0;
    } else {
        p.setPosition(x || 0, y || 0, z || 0);
    }

    // Distance-based lowpass filter — far sounds get muffled
    const distFilter = ctx.createBiquadFilter();
    distFilter.type = 'lowpass';
    const dist = Math.sqrt((x || 0) ** 2 + (y || 0) ** 2 + (z || 0) ** 2);
    const t = Math.min(dist / 15, 1);
    distFilter.frequency.value = 800 + Math.pow(1 - t, 2) * 19200;
    distFilter.Q.value = 0.5;

    // Store filter on panner for easy access in updateSpatialSources
    p._distFilter = distFilter;

    // Chain: [source] → distFilter → panner
    // Caller should connect source to distFilter, and panner to output
    return p;
}

// Create HRTF with distance filter connected: source → distFilter → panner → output
function connectHRTF(source, panner, output) {
    if (panner._distFilter) {
        source.connect(panner._distFilter);
        panner._distFilter.connect(panner);
    } else {
        source.connect(panner);
    }
    panner.connect(output);
}

function setPannerPos(p, x, y, z) {
    if (p.positionX) {
        p.positionX.value = x;
        p.positionY.value = y;
        p.positionZ.value = z;
    } else {
        p.setPosition(x, y, z);
    }
}

// ========== MOVEMENT SYSTEM ==========

function randomMovement() {
    const types = ['orbit', 'wander', 'flyby', 'hover', 'spiral', 'risefall', 'approach', 'passby'];
    return types[Math.floor(Math.random() * types.length)];
}

function createSpatialSource(panner, movementType, durationHint) {
    const speed = (0.2 + Math.random() * 0.8) * params.movement;
    const radius = 2 + Math.random() * 10;
    const startAngle = Math.random() * Math.PI * 2;
    const height = (Math.random() - 0.5) * 6;
    const src = {
        panner,
        type: movementType || randomMovement(),
        time: 0,
        speed,
        radius,
        startAngle,
        height,
        alive: true,
        // Wander waypoints
        wx: (Math.random() - 0.5) * 16,
        wy: (Math.random() - 0.5) * 6,
        wz: (Math.random() - 0.5) * 16,
        wtx: (Math.random() - 0.5) * 16,
        wty: (Math.random() - 0.5) * 6,
        wtz: (Math.random() - 0.5) * 16,
        wanderTimer: 0,
        wanderInterval: 3 + Math.random() * 5,
        // Flyby
        flyFrom: startAngle,
        flySpeed: 1 + Math.random() * 2,
        // Spiral
        spiralDir: Math.random() > 0.5 ? 1 : -1,
        // Duration
        maxLife: durationHint || 999
    };
    spatialSources.push(src);
    return src;
}

function updateSpatialSources(dt) {
    for (let i = spatialSources.length - 1; i >= 0; i--) {
        const s = spatialSources[i];
        if (!s.alive) { spatialSources.splice(i, 1); continue; }

        s.time += dt;
        if (s.time > s.maxLife) { s.alive = false; spatialSources.splice(i, 1); continue; }

        const spd = s.speed * params.movement;
        let x = 0, y = 0, z = 0;

        switch (s.type) {
            case 'orbit': {
                const angle = s.startAngle + s.time * spd * 0.3;
                x = Math.cos(angle) * s.radius;
                z = Math.sin(angle) * s.radius;
                y = s.height + Math.sin(s.time * 0.2) * 0.5;
                break;
            }
            case 'wander': {
                s.wanderTimer += dt;
                if (s.wanderTimer > s.wanderInterval) {
                    s.wanderTimer = 0;
                    s.wx = s.wtx; s.wy = s.wty; s.wz = s.wtz;
                    s.wtx = (Math.random() - 0.5) * 16;
                    s.wty = (Math.random() - 0.5) * 6;
                    s.wtz = (Math.random() - 0.5) * 16;
                    s.wanderInterval = 3 + Math.random() * 5;
                }
                const t = s.wanderTimer / s.wanderInterval;
                const ease = t * t * (3 - 2 * t);
                x = s.wx + (s.wtx - s.wx) * ease;
                y = s.wy + (s.wty - s.wy) * ease;
                z = s.wz + (s.wtz - s.wz) * ease;
                break;
            }
            case 'flyby': {
                // Fly from one side through the listener zone to the other
                const progress = (s.time * s.flySpeed) / 8 - 0.5; // -0.5 to 0.5+ over time
                const angle = s.flyFrom;
                const closeness = 1.5 + Math.random(); // how close it passes
                // Parabolic arc: starts far, comes close at progress=0, goes far again
                const lateral = progress * 25;
                const perpDist = closeness + 8 * progress * progress;
                x = Math.cos(angle) * lateral + Math.sin(angle) * perpDist;
                z = Math.sin(angle) * lateral - Math.cos(angle) * perpDist;
                y = s.height + Math.sin(progress * Math.PI) * 2;
                break;
            }
            case 'approach': {
                // Start far away, come close, then slowly drift away
                const t = s.time * spd * 0.15;
                const dist = Math.max(1.5, 20 - t * 8 + Math.max(0, t - 2) * 3);
                const angle = s.startAngle + t * 0.1;
                x = Math.cos(angle) * dist;
                z = Math.sin(angle) * dist;
                y = s.height + Math.sin(t * 0.3) * 1.5;
                break;
            }
            case 'passby': {
                // Linear pass from far left/right to far opposite, close to listener
                const t = s.time * s.flySpeed * 0.4;
                const angle = s.flyFrom;
                const along = (t - 3) * 5; // -15 to +15 ish
                const perp = 1.5 + Math.sin(t * 0.5) * 0.5;
                x = Math.cos(angle) * along + Math.sin(angle) * perp;
                z = Math.sin(angle) * along - Math.cos(angle) * perp;
                y = s.height + Math.cos(t * 0.4) * 0.8;
                break;
            }
            case 'hover': {
                x = s.radius * Math.cos(s.startAngle) + Math.sin(s.time * 0.7) * 0.5;
                y = s.height + Math.sin(s.time * 0.5) * 0.3;
                z = s.radius * Math.sin(s.startAngle) + Math.cos(s.time * 0.6) * 0.5;
                break;
            }
            case 'spiral': {
                const angle = s.startAngle + s.time * spd * 0.4;
                const r = s.radius + s.spiralDir * s.time * 0.3;
                x = Math.cos(angle) * Math.max(1, r);
                z = Math.sin(angle) * Math.max(1, r);
                y = s.height + s.time * 0.2 * s.spiralDir;
                break;
            }
            case 'risefall': {
                x = s.radius * Math.cos(s.startAngle);
                z = s.radius * Math.sin(s.startAngle);
                y = s.height + Math.sin(s.time * spd * 0.5) * 5;
                break;
            }
        }

        setPannerPos(s.panner, x, y, z);
        s._x = x; s._y = y; s._z = z;

        // Update distance-based lowpass filter
        if (s.panner._distFilter) {
            const dist = Math.sqrt(x * x + y * y + z * z);
            const t = Math.min(dist / 15, 1);
            const cutoff = 800 + Math.pow(1 - t, 2) * 19200;
            s.panner._distFilter.frequency.value = cutoff;
        }
    }
}

// ========== RANDOM RECIPE GENERATOR ==========

// Snap a frequency to the nearest scale tone relative to a root frequency
function quantizeToScale(freq, rootFreq, scale) {
    // Find which semitone interval this freq is from root
    const semiFromRoot = 12 * Math.log2(freq / rootFreq);
    // Find the octave and the position within it
    const octave = Math.floor(semiFromRoot / 12);
    const semiInOctave = ((semiFromRoot % 12) + 12) % 12;
    // Find closest scale tone
    let bestDist = 999, bestSemi = scale[0];
    for (const s of scale) {
        const normS = ((s % 12) + 12) % 12;
        const dist = Math.min(Math.abs(semiInOctave - normS), 12 - Math.abs(semiInOctave - normS));
        if (dist < bestDist) { bestDist = dist; bestSemi = normS; }
    }
    return rootFreq * Math.pow(2, (octave * 12 + bestSemi) / 12);
}

// Note names and scale identification
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Reference: A4 = 440Hz, C4 = 261.63Hz
const C1_FREQ = 32.703; // C1 frequency

function freqToNoteName(freq) {
    const semi = Math.round(12 * Math.log2(freq / C1_FREQ));
    return NOTE_NAMES[((semi % 12) + 12) % 12];
}

function identifyScale(intervals) {
    // Normalize intervals to within one octave
    const norm = [...new Set(intervals.map(i => ((i % 12) + 12) % 12))].sort((a, b) => a - b);
    const key = norm.join(',');
    const scaleNames = {
        '0,2,4,5,7,9,11': 'Major',
        '0,2,3,5,7,8,10': 'Natural Minor',
        '0,2,3,5,7,9,10': 'Dorian',
        '0,3,5,7,10': 'Minor Pentatonic',
        '0,2,4,7,9': 'Major Pentatonic',
        '0,2,4,6,8,10': 'Whole Tone',
        '0,1,3,5,6,8,10': 'Altered',
        '0,2,3,5,7,10': 'Minor (no 6th)',
        '0,3,5,7,10,12': 'Minor Pentatonic',
        '0,2,4,7,9,12': 'Major Pentatonic',
        '0,1,5,6,10,11': 'Tritone',
        '0,3,6,9': 'Diminished',
        '0,3,6,9,12,15': 'Diminished',
        '0,4,7,11,12,16': 'Major 7th',
        '0,4,7,12,16,19': 'Major 7th',
        '0,3,7,10,12,15': 'Minor 7th',
        '0,2,7,9,12,14': 'Sus2',
        '0,1,4,5,8,11': 'Augmented',
        '0,2,3,7,10,12': 'Minor',
        '0,1,3,6,8,10': 'Locrian',
        '0,2,5,7,10,12': 'Minor',
        '0,3,5,7,10,12': 'Minor Pent.',
        '0,2,4,5,7,9': 'Major (no 7th)',
        // Blues + whole tone
        '0,2,3,4,7,9': 'Major Blues',
        '0,3,5,6,7,10': 'Minor Blues',
        '0,2,3,4,7,9,12': 'Major Blues',
        '0,3,5,6,7,10,12': 'Minor Blues',
        '0,2,4,6,8,10,12': 'Whole Tone',
        // Modes
        '0,2,4,6,7,9,11': 'Lydian',
        '0,2,4,5,7,9,10': 'Mixolydian',
        // Japanese
        '0,2,3,7,8': 'Hirajoshi',
        '0,2,3,7,8,12': 'Hirajoshi',
        '0,1,5,7,8': 'In',
        '0,1,5,7,8,12': 'In',
        '0,1,5,6,10': 'Iwato',
        '0,1,5,6,10,12': 'Iwato',
        '0,1,5,7,10': 'Insen',
        '0,1,5,7,10,12': 'Insen',
        '0,2,5,7,9': 'Yo',
        '0,2,5,7,9,12': 'Yo',
        '0,2,3,7,9': 'Kumoi',
        '0,2,3,7,9,12': 'Kumoi',
        '0,4,5,7,11': 'Ryukyu',
        '0,4,5,7,11,12': 'Ryukyu'
    };
    return scaleNames[key] || 'Modal';
}

// Scale pool for Total Sonata — picks one randomly per recipe
const TOTAL_SCALE_POOL = [
    [0, 2, 4, 5, 7, 9, 11],     // Major
    [0, 2, 3, 5, 7, 8, 10],     // Natural Minor
    [0, 2, 3, 5, 7, 9, 10],     // Dorian
    [0, 2, 4, 6, 7, 9, 11],     // Lydian
    [0, 2, 4, 5, 7, 9, 10],     // Mixolydian
    [0, 2, 4, 7, 9, 12],        // Major Pentatonic
    [0, 3, 5, 7, 10, 12],       // Minor Pentatonic
    [0, 2, 3, 4, 7, 9, 12],     // Major Blues
    [0, 3, 5, 6, 7, 10, 12],    // Minor Blues
    [0, 2, 4, 6, 8, 10, 12],    // Whole Tone
    [0, 2, 3, 7, 8, 12],        // Hirajoshi
    [0, 1, 5, 7, 8, 12],        // In
    [0, 1, 5, 6, 10, 12],       // Iwato
    [0, 1, 5, 7, 10, 12],       // Insen
    [0, 2, 5, 7, 9, 12],        // Yo
    [0, 2, 3, 7, 9, 12],        // Kumoi
    [0, 4, 5, 7, 11, 12]        // Ryukyu
];

function generateRecipe() {
    const worldKeys = Object.keys(WORLDS);

    // Pick worlds based on selectedWorld setting
    let picked;
    if (selectedWorld === 'random') {
        picked = [worldKeys[Math.floor(Math.random() * worldKeys.length)]];
    } else if (selectedWorld === 'mixed') {
        const count = 2 + Math.floor(Math.random() * 2);
        const used = new Set();
        picked = [];
        // Avoid mixing special-system worlds
        while (picked.length < count) {
            const k = worldKeys[Math.floor(Math.random() * worldKeys.length)];
            if (!used.has(k) && !WORLDS[k].specialSystem) { used.add(k); picked.push(k); }
        }
        if (picked.length === 0) picked = [worldKeys[0]];
    } else {
        picked = [selectedWorld];
    }

    const worlds = picked.map(k => WORLDS[k]);
    const blend = (fn) => worlds.reduce((a, w) => a + fn(w), 0) / worlds.length;

    // Collect all props from picked worlds
    const allProps = [];
    worlds.forEach(w => { if (w.props) allProps.push(...w.props); });

    // Scale/key from first world
    const scaleWorld = worlds[0];

    // Pick musical key — honor user override
    let keyIndex;
    if (selectedKey !== 'random') {
        const k = NOTE_NAMES.indexOf(selectedKey);
        keyIndex = k >= 0 ? k : Math.floor(Math.random() * 12);
    } else {
        keyIndex = Math.floor(Math.random() * 12);
    }
    const keyName = NOTE_NAMES[keyIndex];
    const blendedBase = blend(w => w.baseFreq);
    const keyBaseC2 = C1_FREQ * 2 * Math.pow(2, keyIndex / 12);
    let baseFreq = keyBaseC2;
    while (baseFreq * 2 <= blendedBase) baseFreq *= 2;
    if (Math.abs(baseFreq * 2 - blendedBase) < Math.abs(baseFreq - blendedBase)) baseFreq *= 2;

    // Merge drone freqs
    const allDrones = [];
    worlds.forEach(w => allDrones.push(...w.droneFreqs));
    let droneFreqs = allDrones.filter(() => Math.random() > 0.3).slice(0, 5);
    if (droneFreqs.length === 0) droneFreqs.push(allDrones[0]);
    droneFreqs = droneFreqs.map(f => quantizeToScale(f, baseFreq, scaleWorld.toneScale));

    // Randomize internal params
    params.brightness = 0.2 + Math.random() * 0.6;
    params.depth = 0.3 + Math.random() * 0.5;
    params.filterCutoff = 0.4 + Math.random() * 0.5;
    params.modSpeed = 0.2 + Math.random() * 0.6;

    // Check if special system
    const specialSystem = worlds[0].specialSystem || null;

    const layers = {
        wind: blend(w => w.windIntensity) > 0.05 && Math.random() > 0.15,
        // Sonatas supply their own textural content via beat-locked voices —
        // skip the granular brushing layer for them
        texture: !['totalSonata', 'forestSonata', 'tundraSonata', 'stormSonata', 'astralSonata'].includes(specialSystem)
                 && Math.random() > 0.2,
        rhythm: !specialSystem && Math.random() > 0.7,
        // Music modes already supply their own pad / bass / chord content —
        // the drone doubles or conflicts with their chord progressions.
        drone: !['totalSonata', 'berlin'].includes(specialSystem) && Math.random() > 0.1,
        props: !specialSystem && allProps.length > 0,
        tone: !specialSystem && Math.random() > 0.3,
        arpeggio: !specialSystem && Math.random() > 0.6,
        pad: !specialSystem && Math.random() > 0.4,
        highway: !specialSystem && Math.random() > 0.65,
        melodicArp: !specialSystem && Math.random() > 0.5,
        chordal: !specialSystem && Math.random() > 0.6,
        polyrhythm: !specialSystem && Math.random() > 0.55
    };

    const textureWorld = worlds[Math.floor(Math.random() * worlds.length)];
    // Scale selection: user-picked scale wins; otherwise pick from the random pool
    // (so "Random" actually randomizes instead of locking to the world's default).
    let toneScale;
    if (selectedScale !== 'random' && SCALES_BY_ID[selectedScale]) {
        toneScale = SCALES_BY_ID[selectedScale];
    } else {
        toneScale = TOTAL_SCALE_POOL[Math.floor(Math.random() * TOTAL_SCALE_POOL.length)];
    }
    const scaleName = identifyScale(toneScale);

    return {
        worldNames: picked,
        worlds,
        specialSystem,
        baseFreq,
        windSpeed: blend(w => w.windSpeed),
        windIntensity: blend(w => w.windIntensity),
        droneFreqs,
        textureType: textureWorld.textureType,
        toneScale,
        filterBase: blend(w => w.filterBase),
        reverbDecay: blend(w => w.reverbDecay),
        props: allProps,
        arpScale: scaleWorld.arpScale || [0, 3, 7, 10, 12],
        arpSpeed: blend(w => w.arpSpeed || 0.3),
        layers,
        keyName,
        scaleName,
        bpm: (() => {
            const defaults = {
                trance: 120 + Math.floor(Math.random() * 20),
                lofi: 70 + Math.floor(Math.random() * 16),
                berlin: 96 + Math.floor(Math.random() * 24),
                dub: 70 + Math.floor(Math.random() * 14),
                forestSonata: 88 + Math.floor(Math.random() * 16),
                tundraSonata: 80 + Math.floor(Math.random() * 16),
                stormSonata: 78 + Math.floor(Math.random() * 14),
                astralSonata: 70 + Math.floor(Math.random() * 16),
                totalSonata: 88 + Math.floor(Math.random() * 24)
            };
            const def = defaults[specialSystem] || null;
            // User tempo override applies whenever the world has a BPM concept
            if (selectedBpm !== 'random' && def !== null) {
                const v = parseInt(selectedBpm);
                if (!isNaN(v)) return v;
            }
            return def;
        })()
    };
}

function updateBlendDescription() {
    const el = document.getElementById('blendDescription');
    if (!recipe) { el.innerHTML = 'Press <strong>Play</strong> to generate a random 3D soundscape.'; return; }

    const tags = recipe.worldNames.map(n => `<span class="env-tag">${WORLDS[n].name}</span>`).join(' ');
    const activeLyrs = Object.entries(recipe.layers).filter(([, v]) => v).map(([k]) => k).join(', ');
    const specialTxt = recipe.specialSystem ? ` | <span style="color:#FF8800">${recipe.specialSystem} active</span>` : '';
    el.innerHTML = `World: ${tags}${specialTxt}<br><span class="param-line">Layers: ${activeLyrs}</span><br><span class="param-line">Props: ${recipe.props.length} types | Drones: ${recipe.droneFreqs.length} voices</span>`;
}

// ========== WIND LAYER (3D) ==========

function createWindLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = r.windIntensity * 0.8 * Math.max(0.4, params.density);
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    // Two wind sources orbiting at different speeds
    for (let w = 0; w < 2; w++) {
        const buf = createNoiseBuffer('pink', 4);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = r.filterBase * (0.3 + w * 0.3);
        bp.Q.value = 0.8;

        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.frequency.value = r.windSpeed * params.modSpeed * (0.3 + w * 0.2);
        lfoG.gain.value = 200 * r.windIntensity;
        lfo.connect(lfoG); lfoG.connect(bp.frequency);

        const g = ctx.createGain();
        g.gain.value = 0.8;

        const panner = createHRTF(0, 0, 0);
        const ss = createSpatialSource(panner, 'orbit', 999);
        ss.radius = 3 + w * 2;
        ss.speed = (0.15 + w * 0.1) * params.movement;

        src.connect(bp); bp.connect(g);
        if (panner._distFilter) { g.connect(panner._distFilter); panner._distFilter.connect(panner); }
        else { g.connect(panner); }
        panner.connect(mainGain);
        src.start(); lfo.start();
        layer.nodes.push(src, lfo);
    }

    layer.gains.push(mainGain);
    return layer;
}

// ========== DRONE LAYER (3D) ==========

function createDroneLayer(r) {
    const layer = { nodes: [], gains: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.45;

    // Warm waveshaper on drone output for harmonic richness
    const shaper = createWarmShaper(1.8 + Math.random() * 0.8);
    mainGain.connect(shaper);
    shaper.connect(masterGain);
    layer.mainGain = mainGain;

    r.droneFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.value = freq;

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 1.002;

        const vib = ctx.createOscillator();
        const vibG = ctx.createGain();
        vib.frequency.value = 0.2 + Math.random() * 0.3 * params.modSpeed;
        vibG.gain.value = freq * 0.005 * params.movement;
        vib.connect(vibG); vibG.connect(osc.frequency); vibG.connect(osc2.frequency);

        const g = ctx.createGain();
        g.gain.value = 0.2 / (i + 1) * params.depth;

        const angle = (i / r.droneFreqs.length) * Math.PI * 2;
        const radius = 2 + Math.random() * 2;
        const panner = createHRTF(Math.cos(angle) * radius, (Math.random() - 0.5) * 2, Math.sin(angle) * radius);
        createSpatialSource(panner, 'hover', 999);

        osc.connect(g); osc2.connect(g);
        if (panner._distFilter) { g.connect(panner._distFilter); panner._distFilter.connect(panner); }
        else { g.connect(panner); }
        panner.connect(mainGain);
        osc.start(); osc2.start(); vib.start();
        layer.nodes.push(osc, osc2, vib);
    });

    layer.gains.push(mainGain);
    return layer;
}

// ========== TEXTURE LAYERS (3D) ==========

function createTextureLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.6 * Math.max(0.4, params.density);

    // Subtle waveshaper on texture for warmth
    const shaper = createWarmShaper(1.5 + Math.random() * 0.5);
    mainGain.connect(shaper);
    shaper.connect(masterGain);
    layer.mainGain = mainGain;

    const makers = {
        leaves: () => createGranularTexture3D(r, mainGain, 'highpass', 2000, 0.02),
        waves: () => createWaveTexture3D(r, mainGain),
        rain: () => createRainTexture3D(r, mainGain),
        sand: () => createGranularTexture3D(r, mainGain, 'bandpass', 3000, 0.01),
        wind: () => createGranularTexture3D(r, mainGain, 'highpass', 1500, 0.03),
        shimmer: () => createShimmerTexture3D(r, mainGain),
        bubbles: () => createBubbleTexture3D(r, mainGain),
        hum: () => createHumTexture3D(r, mainGain),
        machine: () => createMachineTexture3D(r, mainGain),
        ice: () => createIceTexture3D(r, mainGain),
        crackle: () => createCrackleTexture3D(r, mainGain),
        electric: () => createElectricTexture3D(r, mainGain)
    };

    const result = makers[r.textureType]();
    if (result) {
        layer.nodes.push(...(result.nodes || []));
        layer.intervals.push(...(result.intervals || []));
    }
    layer.gains.push(mainGain);
    return layer;
}

function createGranularTexture3D(r, output, filterType, filterFreq, grainDur) {
    const intervals = [];
    const nb = createNoiseBuffer('white', 4);

    function grain() {
        if (!isPlaying) return;
        const src = ctx.createBufferSource(); src.buffer = nb;
        const f = ctx.createBiquadFilter(); f.type = filterType;
        f.frequency.value = filterFreq * (0.5 + Math.random() * params.brightness); f.Q.value = 1 + Math.random() * 2;
        // Lengthen grains substantially and use a smooth (half-cosine-ish) envelope to avoid clicks
        const dur = grainDur * 4 * (0.7 + Math.random() * 1.2);
        const g = ctx.createGain();
        const now = ctx.currentTime;
        const peak = 0.18;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(peak * 0.4, now + dur * 0.15);
        g.gain.linearRampToValueAtTime(peak, now + dur * 0.45);
        g.gain.linearRampToValueAtTime(peak * 0.4, now + dur * 0.75);
        g.gain.linearRampToValueAtTime(0, now + dur);
        const p = createHRTF((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8);
        src.connect(f); f.connect(g); g.connect(p); p.connect(output);
        src.start(); src.stop(now + dur);
    }

    intervals.push(setInterval(grain, 110 + Math.random() * 160 / Math.max(0.3, params.density)));
    return { nodes: [], intervals };
}

function createWaveTexture3D(r, output) {
    const nb = createNoiseBuffer('brown', 4);
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 1;
    const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
    lfo.frequency.value = 0.08 * (1 + params.movement); lfo.type = 'sine'; lfoG.gain.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0.5;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    const p = createHRTF(0, -1, -5);
    createSpatialSource(p, 'orbit', 999).radius = 8;
    src.connect(f); f.connect(g); g.connect(p); p.connect(output);
    src.start(); lfo.start();
    return { nodes: [src, lfo], intervals: [] };
}

function createRainTexture3D(r, output) {
    const nodes = []; const intervals = [];
    const nb = createNoiseBuffer('white', 4);
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1000;
    const g = ctx.createGain(); g.gain.value = 0.3 * params.density;
    const p = createHRTF(0, 5, 0);
    createSpatialSource(p, 'hover', 999).radius = 2;
    src.connect(f); f.connect(g); g.connect(p); p.connect(output);
    src.start(); nodes.push(src);

    function drop() {
        if (!isPlaying) return;
        const osc = ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.value = 2000 + Math.random() * 4000;
        const dg = ctx.createGain();
        dg.gain.setValueAtTime(0.1, ctx.currentTime);
        dg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        const dp = createHRTF((Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 6);
        osc.connect(dg); dg.connect(dp); dp.connect(output);
        osc.start(); osc.stop(ctx.currentTime + 0.05);
    }
    intervals.push(setInterval(drop, 20 + Math.random() * 80 / params.density));
    return { nodes, intervals };
}

function createShimmerTexture3D(r, output) {
    const intervals = [];
    function shimmer() {
        if (!isPlaying) return;
        const osc = ctx.createOscillator(); osc.type = 'sine';
        const bf = 800 + Math.random() * 2000; osc.frequency.value = bf;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = bf * 1.5;
        const dur = 0.5 + Math.random();
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + dur * 0.3);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
        const p = createHRTF((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 8);
        osc.connect(g); osc2.connect(g); g.connect(p); p.connect(output);
        osc.start(); osc2.start(); osc.stop(ctx.currentTime + dur); osc2.stop(ctx.currentTime + dur);
    }
    intervals.push(setInterval(shimmer, 200 + Math.random() * 500 / params.density));
    return { nodes: [], intervals };
}

function createBubbleTexture3D(r, output) {
    const intervals = [];
    function bubble() {
        if (!isPlaying) return;
        const osc = ctx.createOscillator(); osc.type = 'sine';
        const sf = 200 + Math.random() * 800;
        osc.frequency.setValueAtTime(sf, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(sf * 2, ctx.currentTime + 0.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.1, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        const p = createHRTF((Math.random() - 0.5) * 5, -1 + Math.random() * 3, (Math.random() - 0.5) * 5);
        osc.connect(g); g.connect(p); p.connect(output);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
    }
    intervals.push(setInterval(bubble, 80 + Math.random() * 300 / Math.max(0.3, params.density)));
    return { nodes: [], intervals };
}

function createHumTexture3D(r, output) {
    const nodes = [];
    // Lock hum partials to the recipe root so it stays in tune with the music
    const root = (r && r.baseFreq) ? r.baseFreq * 0.5 : 60;
    [root, root * 2, root * 3].forEach((freq, i) => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const g = ctx.createGain(); g.gain.value = 0.05 / (i + 1);
        const angle = (i / 3) * Math.PI * 2;
        const p = createHRTF(Math.cos(angle) * 4, 0, Math.sin(angle) * 4);
        createSpatialSource(p, 'hover', 999);
        osc.connect(g); g.connect(p); p.connect(output); osc.start(); nodes.push(osc);
    });
    return { nodes, intervals: [] };
}

function createMachineTexture3D(r, output) {
    const nodes = [];
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 40;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 2 + params.movement * 3;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.2;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    const p = createHRTF(3, -1, -3);
    createSpatialSource(p, 'orbit', 999).speed = 0.1;
    osc.connect(g); g.connect(p); p.connect(output); osc.start(); lfo.start();
    nodes.push(osc, lfo);
    return { nodes, intervals: [] };
}

function createIceTexture3D(r, output) {
    const intervals = [];
    function crystal() {
        if (!isPlaying) return;
        const osc = ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.value = 2000 + Math.random() * 6000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000; f.Q.value = 10;
        const p = createHRTF((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 7);
        osc.connect(f); f.connect(g); g.connect(p); p.connect(output);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
    intervals.push(setInterval(crystal, 200 + Math.random() * 500 / Math.max(0.3, params.density)));
    return { nodes: [], intervals };
}

function createCrackleTexture3D(r, output) {
    const nodes = []; const intervals = [];
    const nb = createNoiseBuffer('brown', 4);
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 100;
    const g = ctx.createGain(); g.gain.value = 0.4;
    const p = createHRTF(0, -2, 0);
    createSpatialSource(p, 'hover', 999);
    src.connect(f); f.connect(g); g.connect(p); p.connect(output); src.start(); nodes.push(src);

    function crackle() {
        if (!isPlaying) return;
        const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.1);
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.2, ctx.currentTime);
        cg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        const cf = ctx.createBiquadFilter(); cf.type = 'bandpass';
        cf.frequency.value = 500 + Math.random() * 2000; cf.Q.value = 5;
        const cp = createHRTF((Math.random() - 0.5) * 4, -0.5 + Math.random() * 1.5, (Math.random() - 0.5) * 4);
        n.connect(cf); cf.connect(cg); cg.connect(cp); cp.connect(output);
        n.start(); n.stop(ctx.currentTime + 0.05);
    }
    intervals.push(setInterval(crackle, 50 + Math.random() * 150 / params.density));
    return { nodes, intervals };
}

function createElectricTexture3D(r, output) {
    const nodes = []; const intervals = [];
    // Pitch the saw carrier to the recipe root so the wah sweep is in tune
    const carrierFreq = (r && r.baseFreq) ? r.baseFreq : 100;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = carrierFreq;
    // Center the bandpass on a scale-relevant overtone (5th harmonic of root)
    const filterCenter = carrierFreq * 5;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterCenter; f.Q.value = 5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 8;
    const lfoG = ctx.createGain(); lfoG.gain.value = filterCenter * 0.4;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    const g = ctx.createGain(); g.gain.value = 0.15;
    const p = createHRTF(5, 1, -3);
    createSpatialSource(p, 'orbit', 999).speed = 0.2;
    osc.connect(f); f.connect(g); g.connect(p); p.connect(output); osc.start(); lfo.start();
    nodes.push(osc, lfo);

    function spark() {
        if (!isPlaying) return;
        const now = ctx.currentTime;
        const dur = 0.12 + Math.random() * 0.18;
        const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.5);
        const sf = ctx.createBiquadFilter(); sf.type = 'bandpass';
        sf.frequency.value = 1800 + Math.random() * 1500; sf.Q.value = 3;
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0, now);
        sg.gain.linearRampToValueAtTime(0.05, now + 0.025);
        sg.gain.linearRampToValueAtTime(0.05, now + dur * 0.5);
        sg.gain.exponentialRampToValueAtTime(0.001, now + dur);
        const sp = createHRTF((Math.random() - 0.5) * 6, Math.random() * 3, (Math.random() - 0.5) * 6);
        n.connect(sf); sf.connect(sg); sg.connect(sp); sp.connect(output);
        n.start(); n.stop(now + dur);
    }
    intervals.push(setInterval(spark, 350 + Math.random() * 600 / params.density));
    return { nodes, intervals };
}

// ========== TONE LAYER (3D) ==========

function createToneLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.35 * Math.max(0.3, params.brightness);
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    function playTone() {
        if (!isPlaying) return;
        const si = Math.floor(Math.random() * r.toneScale.length);
        const semi = r.toneScale[si];
        const freq = r.baseFreq * Math.pow(2, semi / 12) * (1 + params.brightness);

        const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 2;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 4; f.Q.value = 1;

        const atk = 0.1 + Math.random() * 0.3;
        const sus = 0.5 + Math.random() * 1.5;
        const rel = 0.5 + Math.random() * 1;
        const dur = atk + sus + rel;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + atk);
        g.gain.setValueAtTime(0.3, ctx.currentTime + atk + sus);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);

        const p = createHRTF((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 7);
        const ss = createSpatialSource(p, randomMovement(), dur + 1);

        osc.connect(f); osc2.connect(f); f.connect(g); g.connect(p); p.connect(mainGain);
        osc.start(); osc2.start(); osc.stop(ctx.currentTime + dur); osc2.stop(ctx.currentTime + dur);
    }

    layer.intervals.push(setInterval(playTone, 1500 + Math.random() * 3000 / Math.max(0.3, params.density)));
    layer.gains.push(mainGain);
    return layer;
}

// ========== ARPEGGIO LAYER (3D) ==========

function createArpeggioLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.3 * Math.max(0.3, params.brightness);
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const scale = r.arpScale;
    const speed = (r.arpSpeed || 0.3) * params.modSpeed;
    let ni = 0, dir = 1, octOff = 0;
    let fastMode = false;
    let fastTimer = 0;

    function playNote() {
        if (!isPlaying) return;
        const semi = scale[ni] + octOff * 12;
        const freq = r.baseFreq * Math.pow(2, semi / 12);

        const osc = ctx.createOscillator();
        osc.type = Math.random() > 0.5 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 1.005;

        const f = ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.value = freq * (fastMode ? 6 : 3) * params.brightness; f.Q.value = 1;

        const noteDur = fastMode
            ? 0.05 + Math.random() * 0.06   // Very short in fast mode
            : (60 / (120 * speed)) * 0.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(fastMode ? 0.2 : 0.3, ctx.currentTime + (fastMode ? 0.005 : 0.01));
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + noteDur);

        // Place notes in a ring around listener
        const angle = (ni / scale.length) * Math.PI * 2;
        const p = createHRTF(Math.cos(angle) * 5, 1 + octOff * 2, Math.sin(angle) * 5);

        osc.connect(f); osc2.connect(f); f.connect(g); g.connect(p); p.connect(mainGain);
        osc.start(); osc2.start(); osc.stop(ctx.currentTime + noteDur); osc2.stop(ctx.currentTime + noteDur);

        ni += dir;
        if (ni >= scale.length) {
            if (Math.random() > 0.7) { dir = -1; ni = scale.length - 1; }
            else { ni = 0; if (Math.random() > 0.6) octOff = (octOff + 1) % 2; }
        } else if (ni < 0) { dir = 1; ni = 0; }
    }

    // Normal tempo arp
    const bpm = 80 + speed * 80;
    const normalInterval = setInterval(playNote, 60000 / bpm);
    layer.intervals.push(normalInterval);
    playNote();

    // Periodically switch to fast burst mode (like Sound Strider's rapid phrases)
    let fastInterval = null;
    const burstCheck = setInterval(() => {
        if (!isPlaying) return;

        if (!fastMode && Math.random() < 0.15 * params.density) {
            // Enter fast mode — rapid 16th-note style burst
            fastMode = true;
            const fastBpm = 200 + Math.random() * 200; // 200-400 BPM
            fastInterval = setInterval(playNote, 60000 / fastBpm);
            layer.intervals.push(fastInterval);

            // Exit fast mode after 1-3 seconds
            fastTimer = setTimeout(() => {
                fastMode = false;
                if (fastInterval) { clearInterval(fastInterval); fastInterval = null; }
            }, 1000 + Math.random() * 2000);
        }
    }, 4000 + Math.random() * 6000);

    layer.intervals.push(burstCheck);
    layer.gains.push(mainGain);
    return layer;
}

// ========== RHYTHM LAYER (3D) ==========

function createRhythmLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.2;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    let bi = 0;
    const positions = [
        createHRTF(-3, 0, -2), createHRTF(3, 0, -2),
        createHRTF(0, 0, 3), createHRTF(0, 2, 0)
    ];
    positions.forEach(p => { p.connect(mainGain); createSpatialSource(p, 'hover', 999); });

    function beat() {
        if (!isPlaying) return;
        const freq = r.baseFreq * (bi % 4 === 0 ? 0.5 : 1);
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(g); g.connect(positions[bi % positions.length]);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
        bi++;
    }

    const bpm = 60 + params.movement * 60;
    layer.intervals.push(setInterval(beat, 60000 / bpm));
    layer.gains.push(mainGain);
    return layer;
}

// ========== PROP GENERATORS (3D HRTF) ==========
// Each prop creates its sound and routes through an HRTF panner

function spawnProp3D(name, output) {
    const gen = propGenerators[name];
    if (!gen) return;

    // Place props closer so they're audible, with varied movement
    const dist = 2 + Math.random() * 6;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = (Math.random() - 0.5) * 4;

    const p = createHRTF(x, y, z);
    p.connect(output);

    // Weighted movement selection: more fly-bys, approaches, pass-bys for variety
    const mvTypes = ['orbit', 'wander', 'flyby', 'hover', 'approach', 'passby', 'spiral', 'risefall',
                     'flyby', 'approach', 'passby', 'wander']; // duplicates = higher probability
    const mvType = mvTypes[Math.floor(Math.random() * mvTypes.length)];
    const ss = createSpatialSource(p, mvType, 8 + Math.random() * 10);

    // Randomize pitch shift so same prop type never sounds identical
    const pitchShift = 0.85 + Math.random() * 0.35; // 0.85 to 1.20 multiplier

    const propGain = ctx.createGain();
    propGain.gain.value = 1.2;
    propGain.connect(p);

    gen(ctx, propGain, pitchShift);
}

const propGenerators = {
    // Forest
    bird: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime; const dur = 0.08 + Math.random() * 0.4;
        const car = c.createOscillator();
        car.type = ['sine', 'triangle'][Math.floor(Math.random() * 2)];
        const bf = (1400 + Math.random() * 2800) * ps;
        car.frequency.setValueAtTime(bf, now);
        // Random contour: up, down, or warble
        const contour = Math.random();
        if (contour < 0.33) car.frequency.exponentialRampToValueAtTime(bf * (0.5 + Math.random() * 0.4), now + dur);
        else if (contour < 0.66) car.frequency.exponentialRampToValueAtTime(bf * (1.2 + Math.random() * 0.5), now + dur);
        else { car.frequency.linearRampToValueAtTime(bf * 1.3, now + dur * 0.4); car.frequency.linearRampToValueAtTime(bf * 0.6, now + dur); }
        const mod = c.createOscillator(); const modG = c.createGain();
        mod.frequency.value = (15 + Math.random() * 40) * ps; modG.gain.value = 150 + Math.random() * 400;
        mod.connect(modG); modG.connect(car.frequency);
        const trem = c.createOscillator(); const tremG = c.createGain();
        trem.frequency.value = 10 + Math.random() * 30; tremG.gain.value = 0.2 + Math.random() * 0.3;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.2, now + 0.015);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        trem.connect(tremG); tremG.connect(env.gain);
        car.connect(env); env.connect(out);
        car.start(now); mod.start(now); trem.start(now);
        car.stop(now + dur); mod.stop(now + dur); trem.stop(now + dur);
    },
    cicada: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime; const dur = 0.8 + Math.random() * 3;
        const osc = c.createOscillator(); osc.type = 'triangle';
        osc.frequency.value = (3000 + Math.random() * 2000) * ps;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4500; f.Q.value = 3;
        const am = c.createOscillator(); const amG = c.createGain();
        am.frequency.value = 14 + Math.random() * 8; amG.gain.value = 0.25;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.018, now + 0.5);
        env.gain.setValueAtTime(0.018, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        am.connect(amG); amG.connect(env.gain);
        osc.connect(f); f.connect(env); env.connect(out);
        osc.start(now); am.start(now); osc.stop(now + dur); am.stop(now + dur);
    },
    frog: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 1 + Math.floor(Math.random() * 5); i++) {
            const t = now + i * 0.15;
            const osc = c.createOscillator(); osc.type = 'sine';
            let freq = (100 + Math.random() * 200) * ps;
            if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.1);
            const g = c.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.2, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.12);
        }
    },
    canopy: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 0.5 + Math.random();
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 2);
        const f = c.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.value = 800 + Math.random() * 400; f.Q.value = 1;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.1, now + dur * 0.3);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    owl: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const gap = 0.3 + Math.random() * 0.3;
        [0, gap].forEach(off => {
            const osc = c.createOscillator(); osc.type = 'sine';
            const freq = (250 + Math.random() * 100) * ps;
            osc.frequency.setValueAtTime(freq, now + off);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + off + 0.3);
            const g = c.createGain();
            g.gain.setValueAtTime(0, now + off);
            g.gain.linearRampToValueAtTime(0.15, now + off + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, now + off + 0.35);
            osc.connect(g); g.connect(out); osc.start(now + off); osc.stop(now + off + 0.35);
        });
    },
    // Beach
    seagull: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const osc = c.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(1500 * ps, now);
        osc.frequency.exponentialRampToValueAtTime(2500 * ps, now + 0.1 + Math.random() * 0.1);
        osc.frequency.exponentialRampToValueAtTime(1800 * ps, now + 0.3 + Math.random() * 0.2);
        const vib = c.createOscillator(); const vibG = c.createGain();
        vib.frequency.value = 25; vibG.gain.value = 100;
        vib.connect(vibG); vibG.connect(osc.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.12, now + 0.05);
        env.gain.setValueAtTime(0.12, now + 0.3);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(env); env.connect(out);
        osc.start(now); vib.start(now); osc.stop(now + 0.5); vib.stop(now + 0.5);
    },
    foghorn: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1.5 + Math.random() * 2;
        let ff = (60 + Math.random() * 40) * ps;
        if (recipe) ff = quantizeToScale(ff, recipe.baseFreq, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = ff;
        const osc2 = c.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = ff * 2.01;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200; f.Q.value = 2;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + 0.5);
        env.gain.setValueAtTime(0.15, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(f); osc2.connect(f); f.connect(env); env.connect(out);
        osc.start(now); osc2.start(now); osc.stop(now + dur); osc2.stop(now + dur);
    },
    buoy: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const freq = 800 + Math.random() * 400;
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const osc2 = c.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 2.4;
        const env = c.createGain(); env.gain.setValueAtTime(0.2, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 2);
        const env2 = c.createGain(); env2.gain.setValueAtTime(0.1, now);
        env2.gain.exponentialRampToValueAtTime(0.001, now + 1);
        osc.connect(env); osc2.connect(env2); env.connect(out); env2.connect(out);
        osc.start(now); osc2.start(now); osc.stop(now + 2); osc2.stop(now + 1);
    },
    tide: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 6);
        const f = c.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(200, now);
        f.frequency.linearRampToValueAtTime(600, now + dur * 0.4);
        f.frequency.linearRampToValueAtTime(200, now + dur);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.2, now + dur * 0.3);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    crab: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
            const t = now + i * (0.05 + Math.random() * 0.1);
            const osc = c.createOscillator(); osc.type = 'sine';
            let cf = 2000 + Math.random() * 1000;
            if (recipe) cf = quantizeToScale(cf, recipe.baseFreq, recipe.toneScale);
            osc.frequency.value = cf;
            const g = c.createGain(); g.gain.setValueAtTime(0.1, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.02);
        }
    },
    // Storm
    thunder: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 4);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 100 + Math.random() * 100;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.4, now + 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    lightning: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 1);
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
        const env = c.createGain();
        env.gain.setValueAtTime(0.12, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + 0.1);
    },
    downpour: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 3;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 6);
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 800;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.06, now + 0.3);
        env.gain.setValueAtTime(0.06, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    roll: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 3;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 8);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 80;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 0.5 + Math.random() * 0.5; lfoG.gain.value = 0.15;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.25, now + 0.5);
        env.gain.setValueAtTime(0.25, now + dur - 1);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        lfo.connect(lfoG); lfoG.connect(env.gain);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(now); lfo.start(now); n.stop(now + dur); lfo.stop(now + dur);
    },
    // Desert
    rattlesnake: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 0.5 + Math.random();
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 2);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 6000; f.Q.value = 3;
        const am = c.createOscillator(); const amG = c.createGain();
        am.frequency.value = 30 + Math.random() * 20; amG.gain.value = 0.5;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.1, now + 0.05);
        env.gain.setValueAtTime(0.1, now + dur - 0.1);
        env.gain.linearRampToValueAtTime(0, now + dur);
        am.connect(amG); amG.connect(env.gain);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(now); am.start(now); n.stop(now + dur); am.stop(now + dur);
    },
    vulture: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const osc = c.createOscillator(); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.1, now + 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(f); f.connect(env); env.connect(out); osc.start(now); osc.stop(now + 0.5);
    },
    geyser: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 4);
        const f = c.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.setValueAtTime(500, now);
        f.frequency.linearRampToValueAtTime(2000, now + 0.2);
        f.frequency.linearRampToValueAtTime(800, now + dur); f.Q.value = 1;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.25, now + 0.1);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    mirage: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 2;
        const osc = c.createOscillator(); osc.type = 'sine';
        let mf = 2000 + Math.random() * 1000;
        if (recipe) mf = quantizeToScale(mf, recipe.baseFreq, recipe.toneScale);
        osc.frequency.value = mf;
        const vib = c.createOscillator(); const vibG = c.createGain();
        vib.frequency.value = 6; vibG.gain.value = 50;
        vib.connect(vibG); vibG.connect(osc.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.03, now + dur * 0.3);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(env); env.connect(out);
        osc.start(now); vib.start(now); osc.stop(now + dur); vib.stop(now + dur);
    },
    scorpion: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 5 + Math.floor(Math.random() * 5); i++) {
            const t = now + i * (0.03 + Math.random() * 0.05);
            const osc = c.createOscillator(); osc.type = 'sine';
            let sf = 3000 + Math.random() * 2000;
            if (recipe) sf = quantizeToScale(sf, recipe.baseFreq, recipe.toneScale);
            osc.frequency.value = sf;
            const g = c.createGain(); g.gain.setValueAtTime(0.05, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.015);
        }
    },
    // Mountain
    chimes: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        // Use recipe scale tones in the chime register instead of hardcoded C major
        const scale = recipe ? recipe.toneScale : [0, 2, 4, 5, 7, 9, 11];
        const root = recipe ? recipe.baseFreq : 523;
        const freqs = scale.map(s => root * Math.pow(2, (s + 24) / 12)); // 2 octaves up for chime register
        for (let i = 0; i < 1 + Math.floor(Math.random() * 5); i++) {
            const t = now + Math.random() * 0.5;
            const freq = freqs[Math.floor(Math.random() * freqs.length)] * ps;
            const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
            const osc2 = c.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 2.4;
            const g = c.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.1, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, t + 2);
            const g2 = c.createGain();
            g2.gain.setValueAtTime(0, t);
            g2.gain.linearRampToValueAtTime(0.05, t + 0.01);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 1);
            osc.connect(g); osc2.connect(g2); g.connect(out); g2.connect(out);
            osc.start(t); osc2.start(t); osc.stop(t + 2); osc2.stop(t + 1);
        }
    },
    bowl: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; let bf = (150 + Math.random() * 200) * ps;
        if (recipe) bf = quantizeToScale(bf, recipe.baseFreq, recipe.toneScale);
        [1, 2.4, 3.8, 5.2].forEach((r, i) => {
            const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = bf * r;
            const g = c.createGain(); g.gain.setValueAtTime(0.1 / (i + 1), now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 4 - i * 0.5);
            const vib = c.createOscillator(); const vibG = c.createGain();
            vib.frequency.value = 3 + Math.random() * 2; vibG.gain.value = bf * r * 0.003;
            vib.connect(vibG); vibG.connect(osc.frequency);
            osc.connect(g); g.connect(out);
            osc.start(now); vib.start(now); osc.stop(now + 4); vib.stop(now + 4);
        });
    },
    eagle: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const osc = c.createOscillator(); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200 * ps, now);
        osc.frequency.exponentialRampToValueAtTime(800 * ps, now + 0.4 + Math.random() * 0.4);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 3;
        const vib = c.createOscillator(); const vibG = c.createGain();
        vib.frequency.value = 10; vibG.gain.value = 50;
        vib.connect(vibG); vibG.connect(osc.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.1, now + 0.1);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(f); f.connect(env); env.connect(out);
        osc.start(now); vib.start(now); osc.stop(now + 0.8); vib.stop(now + 0.8);
    },
    rockfall: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const t = now + i * 0.18 + Math.random() * 0.15;
            const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 1);
            const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200 + Math.random() * 300;
            const dur = 0.22 + Math.random() * 0.15;
            const g = c.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.13, t + 0.015);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + dur);
        }
    },
    goat: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const osc = c.createOscillator(); osc.type = 'sawtooth';
        let freq = 300 + Math.random() * 100;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.setValueAtTime(freq * 1.1, now + 0.1);
        osc.frequency.setValueAtTime(freq * 0.9, now + 0.2);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2;
        const trem = c.createOscillator(); const tremG = c.createGain();
        trem.frequency.value = 20; tremG.gain.value = 0.3;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.12, now + 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        trem.connect(tremG); tremG.connect(env.gain);
        osc.connect(f); f.connect(env); env.connect(out);
        osc.start(now); trem.start(now); osc.stop(now + 0.4); trem.stop(now + 0.4);
    },
    // Sky
    pulsar: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const osc = c.createOscillator(); osc.type = 'sine';
        osc.frequency.value = 100 + Math.random() * 50;
        const am = c.createOscillator(); const amG = c.createGain();
        am.frequency.value = 13 + Math.random() * 5; amG.gain.value = 0.5;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + 0.5);
        env.gain.setValueAtTime(0.15, now + 1.5);
        env.gain.linearRampToValueAtTime(0, now + 2);
        am.connect(amG); amG.connect(env.gain);
        osc.connect(env); env.connect(out);
        osc.start(now); am.start(now); osc.stop(now + 2); am.stop(now + 2);
    },
    comet: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1.5 + Math.random();
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 3);
        const f = c.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.setValueAtTime(4000, now);
        f.frequency.exponentialRampToValueAtTime(500, now + dur); f.Q.value = 2;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.1, now + 0.1);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    aurora: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 2;
        [200, 300, 400, 500].forEach(freq => {
            const osc = c.createOscillator(); osc.type = 'sine';
            osc.frequency.value = freq + Math.random() * 20;
            const lfo = c.createOscillator(); const lfoG = c.createGain();
            lfo.frequency.value = 0.2 + Math.random() * 0.3; lfoG.gain.value = freq * 0.05;
            lfo.connect(lfoG); lfoG.connect(osc.frequency);
            const g = c.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.03, now + dur * 0.3);
            g.gain.linearRampToValueAtTime(0, now + dur);
            osc.connect(g); g.connect(out);
            osc.start(now); lfo.start(now); osc.stop(now + dur); lfo.stop(now + dur);
        });
    },
    celestial: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 2;
        let bf = 400 + Math.random() * 200;
        if (recipe) bf = quantizeToScale(bf, recipe.baseFreq, recipe.toneScale);
        [1, 1.5, 2, 3].forEach((r, i) => {
            const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = bf * r;
            const vib = c.createOscillator(); const vibG = c.createGain();
            vib.frequency.value = 4 + Math.random() * 2; vibG.gain.value = bf * r * 0.01;
            vib.connect(vibG); vibG.connect(osc.frequency);
            const g = c.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.05 / (i + 1), now + 0.5);
            g.gain.linearRampToValueAtTime(0, now + dur);
            osc.connect(g); g.connect(out);
            osc.start(now); vib.start(now); osc.stop(now + dur); vib.stop(now + dur);
        });
    },
    starfield: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 5 + Math.floor(Math.random() * 5); i++) {
            const t = now + Math.random();
            const osc = c.createOscillator(); osc.type = 'sine';
            let sf = 2000 + Math.random() * 4000;
            if (recipe) sf = quantizeToScale(sf, recipe.baseFreq, recipe.toneScale);
            osc.frequency.value = sf;
            const g = c.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.05, t + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.3);
        }
    },
    // Aquatic
    dolphin: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
            const t = now + i * 0.08;
            const osc = c.createOscillator(); osc.type = 'sine';
            osc.frequency.value = 8000 + Math.random() * 4000;
            const g = c.createGain(); g.gain.setValueAtTime(0.08, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.01);
        }
        const wt = now + 0.4;
        const w = c.createOscillator(); w.type = 'sine';
        w.frequency.setValueAtTime(4000, wt);
        w.frequency.linearRampToValueAtTime(8000, wt + 0.2);
        w.frequency.linearRampToValueAtTime(5000, wt + 0.4);
        const wg = c.createGain();
        wg.gain.setValueAtTime(0, wt);
        wg.gain.linearRampToValueAtTime(0.08, wt + 0.05);
        wg.gain.linearRampToValueAtTime(0, wt + 0.4);
        w.connect(wg); wg.connect(out); w.start(wt); w.stop(wt + 0.4);
    },
    whale: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 4;
        const osc = c.createOscillator(); osc.type = 'sine';
        const sf = (70 + Math.random() * 80) * ps;
        osc.frequency.setValueAtTime(sf, now);
        osc.frequency.linearRampToValueAtTime(sf * 1.5, now + dur * 0.3);
        osc.frequency.linearRampToValueAtTime(sf * 0.8, now + dur);
        const vib = c.createOscillator(); const vibG = c.createGain();
        vib.frequency.value = 3; vibG.gain.value = 10;
        vib.connect(vibG); vibG.connect(osc.frequency);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + 0.5);
        env.gain.setValueAtTime(0.15, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(f); f.connect(env); env.connect(out);
        osc.start(now); vib.start(now); osc.stop(now + dur); vib.stop(now + dur);
    },
    sonar: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; let freq = (1200 + Math.random() * 800) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const env = c.createGain(); env.gain.setValueAtTime(0.2, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 1);
        osc.connect(env); env.connect(out); osc.start(now); osc.stop(now + 1);
    },
    submarine: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 2;
        [50, 100, 150].forEach(f => {
            let freq = f;
            if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
            const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
            const g = c.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.05 / (freq / 50), now + 0.3);
            g.gain.setValueAtTime(0.05 / (freq / 50), now + dur - 0.3);
            g.gain.linearRampToValueAtTime(0, now + dur);
            osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + dur);
        });
    },
    glitter: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 8 + Math.floor(Math.random() * 8); i++) {
            const t = now + Math.random() * 0.5;
            const osc = c.createOscillator(); osc.type = 'sine';
            let gf = 3000 + Math.random() * 5000;
            if (recipe) gf = quantizeToScale(gf, recipe.baseFreq, recipe.toneScale);
            osc.frequency.value = gf;
            const g = c.createGain(); g.gain.setValueAtTime(0.04, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.1);
        }
    },
    // Urban
    siren: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1.5 + Math.random() * 3;
        const osc = c.createOscillator(); osc.type = 'sawtooth';
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 0.3 + Math.random() * 0.5; lfoG.gain.value = 150 + Math.random() * 150;
        const cs = c.createConstantSource(); cs.offset.value = (400 + Math.random() * 400) * ps;
        const fsum = c.createGain(); fsum.gain.value = 1;
        lfo.connect(lfoG); lfoG.connect(fsum); cs.connect(fsum); fsum.connect(osc.frequency);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 1;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.08, now + 0.2);
        env.gain.setValueAtTime(0.08, now + dur - 0.3);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(f); f.connect(env); env.connect(out);
        osc.start(now); lfo.start(now); cs.start(now);
        osc.stop(now + dur); lfo.stop(now + dur); cs.stop(now + dur);
    },
    metro: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 6);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 200; f.Q.value = 1;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 4; lfoG.gain.value = 0.3;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + 0.5);
        env.gain.setValueAtTime(0.15, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        lfo.connect(lfoG); lfoG.connect(env.gain);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(now); lfo.start(now); n.stop(now + dur); lfo.stop(now + dur);
    },
    radio: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 4);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 3;
        const osc = c.createOscillator(); osc.type = 'sine';
        osc.frequency.value = 1000 + Math.random() * 500;
        const am = c.createOscillator(); const amG = c.createGain();
        am.frequency.value = 0.5; amG.gain.value = 0.5;
        const env = c.createGain();
        env.gain.setValueAtTime(0.03, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        am.connect(amG); amG.connect(env.gain);
        n.connect(f); f.connect(env); osc.connect(env); env.connect(out);
        n.start(now); osc.start(now); am.start(now);
        n.stop(now + dur); osc.stop(now + dur); am.stop(now + dur);
    },
    traffic: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 3;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 6);
        const f = c.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(100, now);
        f.frequency.linearRampToValueAtTime(400, now + dur * 0.4);
        f.frequency.linearRampToValueAtTime(100, now + dur);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.1, now + dur * 0.2);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    neon: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random() * 2;
        let nf = 120;
        if (recipe) nf = quantizeToScale(nf, recipe.baseFreq, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = nf;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = nf * 2; f.Q.value = 10;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 0.3 + Math.random() * 0.5; lfoG.gain.value = 0.5;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.05, now + 0.1);
        env.gain.setValueAtTime(0.05, now + dur - 0.1);
        env.gain.linearRampToValueAtTime(0, now + dur);
        lfo.connect(lfoG); lfoG.connect(env.gain);
        osc.connect(f); f.connect(env); env.connect(out);
        osc.start(now); lfo.start(now); osc.stop(now + dur); lfo.stop(now + dur);
    },
    audiophile: (c, out, ps) => {
        // Distant car blasting bass — sub-octave woofs through soft saturator
        ps = ps || 1;
        const now = c.currentTime;
        let bf = (recipe ? recipe.baseFreq : 110) * 0.5;
        if (recipe) bf = quantizeToScale(bf, recipe.baseFreq * 0.5, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = bf;
        // Soft saturation curve for "hot" subwoofer
        const shape = c.createWaveShaper();
        const k = 3;
        const samples = 512;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = i * 2 / samples - 1;
            curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
        }
        shape.curve = curve;
        const env = c.createGain(); env.gain.value = 0;
        const count = 2 + Math.floor(Math.random() * 3);
        const woofGap = 0.6;
        for (let i = 0; i < count; i++) {
            const t = now + i * woofGap;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(0.4, t + 0.03);
            env.gain.linearRampToValueAtTime(0.2, t + 0.2);
            env.gain.setValueAtTime(0.2, t + 0.4);
            env.gain.linearRampToValueAtTime(0.001, t + 0.55);
        }
        osc.connect(env); env.connect(shape); shape.connect(out);
        const totalDur = count * woofGap + 0.05;
        osc.start(now); osc.stop(now + totalDur);
    },
    talker: (c, out, ps) => {
        // Sawtooth through random vowel formants — a few muttered syllables
        ps = ps || 1;
        const now = c.currentTime;
        let f = (recipe ? recipe.baseFreq : 110) * ps;
        if (recipe) f = quantizeToScale(f, recipe.baseFreq, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = f;
        // Vowel formants: a, e, i, o, u
        const vowels = [
            [700, 1220, 2600],
            [400, 1700, 2400],
            [240, 2400, 3300],
            [400, 800, 2600],
            [350, 600, 2400]
        ];
        const formants = vowels[Math.floor(Math.random() * vowels.length)];
        const env = c.createGain(); env.gain.value = 0;
        // Set up formant filter chain
        formants.forEach((freq, i) => {
            const bp = c.createBiquadFilter(); bp.type = 'bandpass';
            bp.frequency.value = freq; bp.Q.value = 8;
            const fg = c.createGain(); fg.gain.value = i === 0 ? 1 : (i === 1 ? 0.6 : 0.3);
            osc.connect(bp); bp.connect(fg); fg.connect(env);
        });
        env.connect(out);
        const numSyll = 2 + Math.floor(Math.random() * 3);
        const syllDur = 0.16 + Math.random() * 0.08;
        const syllGap = 0.06 + Math.random() * 0.05;
        for (let i = 0; i < numSyll; i++) {
            const t = now + i * (syllDur + syllGap);
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(0.1, t + 0.02);
            env.gain.setValueAtTime(0.1, t + syllDur - 0.04);
            env.gain.linearRampToValueAtTime(0, t + syllDur);
        }
        const totalDur = numSyll * (syllDur + syllGap) + 0.05;
        osc.start(now); osc.stop(now + totalDur);
    },
    walker: (c, out, ps) => {
        // Footsteps — a few quiet brown-noise thumps
        const now = c.currentTime;
        const steps = 4 + Math.floor(Math.random() * 4);
        const stepGap = 0.42 + Math.random() * 0.15;
        for (let i = 0; i < steps; i++) {
            const t = now + i * stepGap + (Math.random() - 0.5) * 0.03;
            const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 0.2);
            const f = c.createBiquadFilter(); f.type = 'lowpass';
            f.frequency.value = 550 + Math.random() * 200; f.Q.value = 0.7;
            const g = c.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.16, t + 0.012);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            n.connect(f); f.connect(g); g.connect(out);
            n.start(t); n.stop(t + 0.11);
        }
    },
    urban_arp: (c, out, ps) => {
        // Melodic walker — short scale-locked arpeggio of triangle plucks (footsteps that sing)
        const now = c.currentTime;
        const scale = recipe ? recipe.toneScale : [0, 2, 5, 7, 10, 12];
        const root = recipe ? recipe.baseFreq : 220;
        const steps = 3 + Math.floor(Math.random() * 3);
        const stepGap = 0.3 + Math.random() * 0.12;
        const startDeg = Math.floor(Math.random() * scale.length);
        const dir = Math.random() > 0.5 ? 1 : -1;
        for (let i = 0; i < steps; i++) {
            const t = now + i * stepGap;
            const idx = startDeg + i * dir;
            const oct = Math.floor(idx / scale.length);
            const within = ((idx % scale.length) + scale.length) % scale.length;
            const freq = root * Math.pow(2, (scale[within] + 12 * oct) / 12);
            const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
            const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
            const g2 = c.createGain(); g2.gain.value = 0.16;
            const env = c.createGain();
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(0.13, t + 0.005);
            env.gain.exponentialRampToValueAtTime(0.001, t + stepGap * 0.85);
            o.connect(env); o2.connect(g2); g2.connect(env); env.connect(out);
            o.start(t); o2.start(t);
            o.stop(t + stepGap); o2.stop(t + stepGap);
        }
    },
    // Industrial
    piston: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const rate = 2 + Math.random() * 2;
        for (let i = 0; i < 4; i++) {
            const t = now + i / rate;
            const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 1);
            const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 150;
            const g = c.createGain(); g.gain.setValueAtTime(0.2, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.15);
        }
    },
    conveyor: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 6);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 1;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 3; lfoG.gain.value = 100;
        lfo.connect(lfoG); lfoG.connect(f.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.08, now + 0.2);
        env.gain.setValueAtTime(0.08, now + dur - 0.2);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(now); lfo.start(now); n.stop(now + dur); lfo.stop(now + dur);
    },
    generator: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 2;
        [50, 100, 150, 200].forEach((freq, i) => {
            const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
            const g = c.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.04 / (i + 1), now + 0.3);
            g.gain.setValueAtTime(0.04 / (i + 1), now + dur - 0.3);
            g.gain.linearRampToValueAtTime(0, now + dur);
            osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + dur);
        });
    },
    tesla: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
            const t = now + Math.random() * 0.3;
            const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.5);
            const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4000;
            const g = c.createGain(); g.gain.setValueAtTime(0.15, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.05);
        }
        const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 100;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 200; f.Q.value = 5;
        const env = c.createGain(); env.gain.setValueAtTime(0.05, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(f); f.connect(env); env.connect(out); osc.start(now); osc.stop(now + 0.5);
    },
    alarm: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const osc = c.createOscillator(); osc.type = 'square';
        // Use scale tones if available
        let f1 = 800 * ps, f2 = 600 * ps;
        if (recipe) { f1 = quantizeToScale(f1, recipe.baseFreq, recipe.toneScale); f2 = quantizeToScale(f2, recipe.baseFreq, recipe.toneScale); }
        osc.frequency.setValueAtTime(f1, now);
        osc.frequency.setValueAtTime(f2, now + 0.25);
        osc.frequency.setValueAtTime(f1, now + 0.5);
        osc.frequency.setValueAtTime(f2, now + 0.75);
        const env = c.createGain(); env.gain.setValueAtTime(0.04, now);
        env.gain.setValueAtTime(0.04, now + 0.9);
        env.gain.linearRampToValueAtTime(0, now + 1);
        osc.connect(env); env.connect(out); osc.start(now); osc.stop(now + 1);
    },
    // Tundra
    wolf: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1.5 + Math.random() * 2;
        const osc = c.createOscillator(); osc.type = 'sawtooth';
        const bf = (150 + Math.random() * 100) * ps;
        osc.frequency.setValueAtTime(bf, now);
        osc.frequency.linearRampToValueAtTime(bf * 2, now + dur * 0.3);
        osc.frequency.linearRampToValueAtTime(bf * 1.5, now + dur * 0.7);
        osc.frequency.linearRampToValueAtTime(bf * 0.8, now + dur);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 2;
        const vib = c.createOscillator(); const vibG = c.createGain();
        vib.frequency.value = 5; vibG.gain.value = 20;
        vib.connect(vibG); vibG.connect(osc.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.12, now + 0.2);
        env.gain.setValueAtTime(0.12, now + dur * 0.8);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(f); f.connect(env); env.connect(out);
        osc.start(now); vib.start(now); osc.stop(now + dur); vib.stop(now + dur);
    },
    glacier: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random();
        const osc = c.createOscillator(); osc.type = 'sine';
        let sf = 50 + Math.random() * 30;
        if (recipe) sf = quantizeToScale(sf, recipe.baseFreq, recipe.toneScale);
        osc.frequency.setValueAtTime(sf, now);
        osc.frequency.exponentialRampToValueAtTime(sf * 0.5, now + dur);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 100;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.2, now + 0.1);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(f); f.connect(env); env.connect(out); osc.start(now); osc.stop(now + dur);
    },
    blizzard: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 6);
        const f = c.createBiquadFilter(); f.type = 'highpass';
        f.frequency.setValueAtTime(500, now);
        f.frequency.linearRampToValueAtTime(2000, now + dur * 0.4);
        f.frequency.linearRampToValueAtTime(500, now + dur);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.06, now + dur * 0.3);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    frost: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 3 + Math.floor(Math.random() * 5); i++) {
            const t = now + Math.random() * 0.5;
            const osc = c.createOscillator(); osc.type = 'sine';
            osc.frequency.value = 4000 + Math.random() * 4000;
            const g = c.createGain(); g.gain.setValueAtTime(0.06, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.05);
        }
    },
    // Magma
    eruption: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1.5 + Math.random();
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 4);
        const f = c.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(50, now);
        f.frequency.linearRampToValueAtTime(300, now + 0.2);
        f.frequency.exponentialRampToValueAtTime(50, now + dur);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.3, now + 0.1);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    lavaflow: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 6);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 80;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 0.3; lfoG.gain.value = 30;
        lfo.connect(lfoG); lfoG.connect(f.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + 0.5);
        env.gain.setValueAtTime(0.15, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(now); lfo.start(now); n.stop(now + dur); lfo.stop(now + dur);
    },
    rumble: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 2;
        const osc = c.createOscillator(); osc.type = 'sine';
        let rf = 30 + Math.random() * 20;
        if (recipe) rf = quantizeToScale(rf, recipe.baseFreq, recipe.toneScale);
        osc.frequency.value = rf;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 0.5; lfoG.gain.value = 10;
        lfo.connect(lfoG); lfoG.connect(osc.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.2, now + 0.3);
        env.gain.setValueAtTime(0.2, now + dur - 0.3);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(env); env.connect(out);
        osc.start(now); lfo.start(now); osc.stop(now + dur); lfo.stop(now + dur);
    },
    hiss: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 0.5 + Math.random();
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 2);
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.1, now + 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    ember: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
            const t = now + Math.random() * 0.3;
            const osc = c.createOscillator(); osc.type = 'sine';
            let ef = 500 + Math.random() * 500;
            if (recipe) ef = quantizeToScale(ef, recipe.baseFreq, recipe.toneScale);
            osc.frequency.value = ef;
            const g = c.createGain(); g.gain.setValueAtTime(0.1, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.08);
        }
    },
    // Plasma
    quasar: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random() * 2;
        const osc = c.createOscillator(); osc.type = 'sine';
        let qf = (100 + Math.random() * 100) * ps;
        if (recipe) qf = quantizeToScale(qf, recipe.baseFreq, recipe.toneScale);
        osc.frequency.value = qf;
        const am = c.createOscillator(); const amG = c.createGain();
        am.frequency.value = 20 + Math.random() * 10; amG.gain.value = 0.5;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 2; lfoG.gain.value = 30;
        lfo.connect(lfoG); lfoG.connect(osc.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + 0.2);
        env.gain.setValueAtTime(0.15, now + dur - 0.3);
        env.gain.linearRampToValueAtTime(0, now + dur);
        am.connect(amG); amG.connect(env.gain);
        osc.connect(env); env.connect(out);
        osc.start(now); am.start(now); lfo.start(now);
        osc.stop(now + dur); am.stop(now + dur); lfo.stop(now + dur);
    },
    warp: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 0.8 + Math.random() * 1.5;
        const osc = c.createOscillator(); osc.type = ['sawtooth', 'square'][Math.floor(Math.random() * 2)];
        const base = (60 + Math.random() * 80) * ps;
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(base * (10 + Math.random() * 20), now + dur * 0.5);
        osc.frequency.exponentialRampToValueAtTime(base, now + dur);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 5;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.1, now + dur * 0.2);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(f); f.connect(env); env.connect(out); osc.start(now); osc.stop(now + dur);
    },
    ion: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
            const t = now + i * 0.1;
            const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.5);
            const f = c.createBiquadFilter(); f.type = 'bandpass';
            f.frequency.value = 3000 + Math.random() * 3000; f.Q.value = 10;
            const g = c.createGain(); g.gain.setValueAtTime(0.1, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.03);
        }
    },
    singularity: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 4;
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = (20 + Math.random() * 20) * ps;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 0.1; lfoG.gain.value = 10;
        lfo.connect(lfoG); lfoG.connect(osc.frequency);
        const osc2 = c.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 60;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + 1);
        env.gain.setValueAtTime(0.15, now + dur - 1);
        env.gain.linearRampToValueAtTime(0, now + dur);
        const env2 = c.createGain();
        env2.gain.setValueAtTime(0, now);
        env2.gain.linearRampToValueAtTime(0.08, now + 1);
        env2.gain.setValueAtTime(0.08, now + dur - 1);
        env2.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(env); osc2.connect(env2); env.connect(out); env2.connect(out);
        osc.start(now); osc2.start(now); lfo.start(now);
        osc.stop(now + dur); osc2.stop(now + dur); lfo.stop(now + dur);
    },

    // ===== NEW SYNTH-BASED PROPS =====

    ghost: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 3;
        // Breathy formant-like FM — ghostly vocal texture
        const formants = [270, 530, 950];
        let chosen = formants[Math.floor(Math.random() * formants.length)] * ps;
        if (recipe) chosen = quantizeToScale(chosen, recipe.baseFreq, recipe.toneScale);
        const s = synthFM(chosen, chosen * (1.5 + Math.random()), chosen * 0.3, 'sine', now, dur, null);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = chosen; f.Q.value = 8;
        const breath = c.createBufferSource(); breath.buffer = createNoiseBuffer('pink', 4);
        const breathG = c.createGain(); breathG.gain.value = 0.03;
        s.output.connect(f); breath.connect(breathG); breathG.connect(f); f.connect(out);
        breath.start(now); breath.stop(now + dur);
    },

    crystal_bell: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 2;
        // Inharmonic FM ratios for glass/bell timbre — snap base to scale
        let base = (400 + Math.random() * 600) * ps;
        if (recipe) base = quantizeToScale(base, recipe.baseFreq, recipe.toneScale);
        const ratios = [1, 2.76, 5.4, 8.93];
        ratios.forEach((r, i) => {
            const s = synthFM(base * r, base * r * 1.41, base * r * 0.5, 'sine', now, dur - i * 0.3, null);
            const g = c.createGain(); g.gain.setValueAtTime(0.08 / (i + 1), now);
            g.gain.exponentialRampToValueAtTime(0.001, now + dur - i * 0.3);
            s.output.connect(g); g.connect(out);
        });
    },

    wind_voice: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 4;
        // AM with slow mod — eerie wind whisper
        let freq = (200 + Math.random() * 300) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        const s = synthAM(freq, 0.5 + Math.random() * 2, 0.6, 'triangle', now, dur, null);
        const f = c.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.value = freq * 2; f.Q.value = 3;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 6);
        const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = freq; nf.Q.value = 5;
        const ng = c.createGain(); ng.gain.value = 0.05;
        s.output.connect(f); f.connect(out);
        n.connect(nf); nf.connect(ng); ng.connect(out);
        n.start(now); n.stop(now + dur);
    },

    pulse_beacon: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 2;
        // Rhythmic AM synth — distant signal beacon (quieter)
        let freq = (300 + Math.random() * 500) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        const pulseRate = 2 + Math.random() * 4;
        const s = synthAM(freq, pulseRate, 0.9, 'sine', now, dur, null);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 5;
        const vol = c.createGain(); vol.gain.value = 0.4;
        s.output.connect(f); f.connect(vol); vol.connect(out);
    },

    metal_groan: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime; const dur = 1.5 + Math.random() * 2;
        // Very low FM — industrial stress/strain sound
        const base = (30 + Math.random() * 40) * ps;
        const s = synthFM(base, base * 0.7, base * 2, 'sawtooth', now, dur, null);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200; f.Q.value = 3;
        s.output.connect(f); f.connect(out);
    },

    swarm: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random() * 2;
        // Multiple detuned oscillators — insect swarm
        let base = (150 + Math.random() * 200) * ps;
        if (recipe) base = quantizeToScale(base, recipe.baseFreq, recipe.toneScale);
        const count = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const osc = c.createOscillator();
            osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
            osc.frequency.value = base * (0.95 + Math.random() * 0.1);
            const g = c.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.02, now + dur * 0.2);
            g.gain.setValueAtTime(0.02, now + dur * 0.7);
            g.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + dur);
        }
    },

    deep_horn: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 3;
        // Low FM brass — distant horn call
        let base = (60 + Math.random() * 50) * ps;
        if (recipe) base = quantizeToScale(base, recipe.baseFreq, recipe.toneScale);
        const s = synthFM(base, base * 2, base * 0.8, 'sawtooth', now, dur, null);
        const f = c.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(base * 2, now);
        f.frequency.linearRampToValueAtTime(base * 6, now + dur * 0.3);
        f.frequency.linearRampToValueAtTime(base * 2, now + dur);
        f.Q.value = 1;
        s.output.connect(f); f.connect(out);
    },

    spark_shower: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime;
        // Rapid burst of FM pings at random pitches
        const count = 8 + Math.floor(Math.random() * 12);
        for (let i = 0; i < count; i++) {
            const t = now + Math.random() * 0.6;
            let freq = (800 + Math.random() * 4000) * ps;
            if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
            const s = synthFM(freq, freq * 1.5, freq * 0.3, 'sine', t, 0.05 + Math.random() * 0.1, null);
            const g = c.createGain(); g.gain.setValueAtTime(0.06, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            s.output.connect(g); g.connect(out);
        }
    },

    // ===== MUSIC BOX — rapid melodic phrase bursts (like Sound Strider's quest/musicBox) =====

    music_box: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime;
        // Pick a scale from current recipe or default pentatonic
        const scale = recipe ? recipe.toneScale : [0, 3, 5, 7, 10];
        const baseFreq = (recipe ? recipe.baseFreq : 220) * ps;
        const oscType = ['sine', 'triangle', 'square', 'sawtooth'][Math.floor(Math.random() * 4)];

        // Choose triplet (3) or quadruplet (4) feel
        const feel = Math.random() > 0.5 ? 3 : 4;
        // Tempo: fast — each phrase fills 0.3-0.6s
        const phraseDur = 0.3 + Math.random() * 0.3;
        const noteDur = phraseDur / feel;

        // Generate a phrase of notes
        const octaveOff = Math.floor(Math.random() * 2);
        for (let i = 0; i < feel; i++) {
            const t = now + i * noteDur;
            const semi = scale[Math.floor(Math.random() * scale.length)] + octaveOff * 12;
            const freq = baseFreq * Math.pow(2, semi / 12);
            const detune = (Math.random() - 0.5) * 20; // slight humanize

            const osc = c.createOscillator();
            osc.type = oscType;
            osc.frequency.value = freq;
            osc.detune.value = detune;

            // Bandpass filter that sweeps down (like the real music box)
            const f = c.createBiquadFilter();
            f.type = 'bandpass';
            const filterHi = freq * (3 + Math.random() * 3);
            f.frequency.setValueAtTime(filterHi, t);
            f.frequency.exponentialRampToValueAtTime(freq, t + noteDur * 2);
            f.Q.value = 1;

            // Fast attack, medium decay envelope
            const g = c.createGain();
            const atk = 1 / 32; // fast attack like Sound Strider
            const decay = noteDur * 1.5 + Math.random() * 0.5;
            g.gain.setValueAtTime(0.001, t);
            g.gain.exponentialRampToValueAtTime(0.15, t + atk);
            g.gain.exponentialRampToValueAtTime(0.08, t + atk + noteDur * 0.3);
            g.gain.linearRampToValueAtTime(0, t + decay);

            osc.connect(f); f.connect(g); g.connect(out);
            osc.start(t); osc.stop(t + decay);
        }
    },

    // ===== FAST STACCATO — rapid punchy notes with sharp attack (like Sound Strider's elemental tones) =====

    fast_staccato: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime;
        const scale = recipe ? recipe.toneScale : [0, 2, 4, 7, 9];
        const baseFreq = (recipe ? recipe.baseFreq : 200) * ps;

        // Rapid burst: 4-8 notes in quick succession
        const noteCount = 4 + Math.floor(Math.random() * 5);
        const spacing = 0.06 + Math.random() * 0.08; // 60-140ms per note — very fast
        const oscType = Math.random() > 0.5 ? 'triangle' : 'sawtooth';

        let noteIdx = Math.floor(Math.random() * scale.length);
        let dir = Math.random() > 0.5 ? 1 : -1;
        const octave = Math.floor(Math.random() * 2);

        for (let i = 0; i < noteCount; i++) {
            const t = now + i * spacing;
            const semi = scale[noteIdx % scale.length] + octave * 12;
            const freq = baseFreq * Math.pow(2, semi / 12);

            const osc = c.createOscillator();
            osc.type = oscType;
            osc.frequency.value = freq;

            // Slight detune for richness
            const osc2 = c.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.value = freq * 1.005;

            // Filter
            const f = c.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = freq * 4;
            f.Q.value = 1;

            // Sharp attack, fast decay
            const noteDur = spacing * 1.5;
            const g = c.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.18, t + 0.008); // very fast attack
            g.gain.exponentialRampToValueAtTime(0.001, t + noteDur);

            osc.connect(f); osc2.connect(f); f.connect(g); g.connect(out);
            osc.start(t); osc2.start(t);
            osc.stop(t + noteDur); osc2.stop(t + noteDur);

            // Advance through scale (arpeggio-like)
            noteIdx += dir;
            if (noteIdx >= scale.length) { noteIdx = scale.length - 1; dir = -1; }
            if (noteIdx < 0) { noteIdx = 0; dir = 1; }
        }
    },

    // ===== AQUATIC WORLD =====

    barracuda: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 1);
        const f = c.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.setValueAtTime(400, now);
        f.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
        f.frequency.exponentialRampToValueAtTime(200, now + 0.5);
        f.Q.value = 3;
        const g = c.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.15, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        n.connect(f); f.connect(g); g.connect(out); n.start(now); n.stop(now + 0.5);
        for (let i = 0; i < 3; i++) {
            const t = now + i * 0.06;
            const osc = c.createOscillator(); osc.type = 'sine';
            osc.frequency.value = (800 + Math.random() * 400) * ps;
            const cg = c.createGain(); cg.gain.setValueAtTime(0.08, t);
            cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            osc.connect(cg); cg.connect(out); osc.start(t); osc.stop(t + 0.02);
        }
    },
    clam: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 1);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200; f.Q.value = 2;
        const g = c.createGain(); g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        n.connect(f); f.connect(g); g.connect(out); n.start(now); n.stop(now + 0.3);
        const osc = c.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(150 * ps, now + 0.05);
        osc.frequency.exponentialRampToValueAtTime(80 * ps, now + 0.15);
        const pg = c.createGain(); pg.gain.setValueAtTime(0.08, now + 0.05);
        pg.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(pg); pg.connect(out); osc.start(now + 0.05); osc.stop(now + 0.2);
    },
    aquatic_ripple: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 6 + Math.floor(Math.random() * 6); i++) {
            const t = now + i * 0.04 + Math.random() * 0.02;
            const osc = c.createOscillator(); osc.type = 'sine';
            osc.frequency.value = (4000 + Math.random() * 6000) * ps;
            const g = c.createGain(); g.gain.setValueAtTime(0.04, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.06);
        }
    },

    // ===== BEACH WORLD =====

    beach_wave: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 4;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 8);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 0.5;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 0.12 + Math.random() * 0.05; lfoG.gain.value = 0.5;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.25, now + dur * 0.4);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        lfo.connect(lfoG); lfoG.connect(env.gain);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(now); lfo.start(now); n.stop(now + dur); lfo.stop(now + dur);
    },

    // ===== ASTRAL WORLD =====

    astral_dust: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 5;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 8);
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000; f.Q.value = 0.5;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.04, now + 1);
        env.gain.setValueAtTime(0.04, now + dur - 1);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
        for (let i = 0; i < 3; i++) {
            const t = now + Math.random() * dur;
            const osc = c.createOscillator(); osc.type = 'sine';
            osc.frequency.value = (6000 + Math.random() * 6000) * ps;
            const g = c.createGain(); g.gain.setValueAtTime(0.03, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.5);
        }
    },
    astral_terrestrial: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 4 + Math.random() * 6;
        let freq = (20 + Math.random() * 30) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq * 0.25, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 0.05; lfoG.gain.value = freq * 0.1;
        lfo.connect(lfoG); lfoG.connect(osc.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.12, now + 2);
        env.gain.setValueAtTime(0.12, now + dur - 2);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(env); env.connect(out);
        osc.start(now); lfo.start(now); osc.stop(now + dur); lfo.stop(now + dur);
    },

    // ===== CLASSIC WORLD =====

    classic_bugger: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 0.3 + Math.random() * 0.8;
        const osc = c.createOscillator(); osc.type = 'triangle';
        const bf = (200 + Math.random() * 400) * ps;
        osc.frequency.value = bf;
        const trill = c.createOscillator(); const trillG = c.createGain();
        trill.frequency.value = 8 + Math.random() * 6; trillG.gain.value = 12;
        trill.connect(trillG); trillG.connect(osc.frequency);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = bf * 2.5; f.Q.value = 2;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.025, now + 0.08);
        env.gain.setValueAtTime(0.025, now + dur - 0.08);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(f); f.connect(env); env.connect(out);
        osc.start(now); trill.start(now); osc.stop(now + dur); trill.stop(now + dur);
    },
    classic_campfire: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 3;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 6);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.08, now + 0.3);
        env.gain.setValueAtTime(0.08, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
        for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
            const t = now + Math.random() * dur;
            const pop = c.createBufferSource(); pop.buffer = createNoiseBuffer('white', 0.5);
            const pf = c.createBiquadFilter(); pf.type = 'bandpass';
            pf.frequency.value = 1500 + Math.random() * 800; pf.Q.value = 2;
            const pg = c.createGain();
            pg.gain.setValueAtTime(0, t);
            pg.gain.linearRampToValueAtTime(0.025, t + 0.008);
            pg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            pop.connect(pf); pf.connect(pg); pg.connect(out); pop.start(t); pop.stop(t + 0.1);
        }
    },
    classic_oinker: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const osc = c.createOscillator(); osc.type = 'sawtooth';
        const sf = (200 + Math.random() * 100) * ps;
        osc.frequency.setValueAtTime(sf, now);
        osc.frequency.exponentialRampToValueAtTime(sf * 0.4, now + 0.3);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 3;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.12, now + 0.03);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(f); f.connect(env); env.connect(out); osc.start(now); osc.stop(now + 0.35);
    },
    classic_subwoofer: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        let freq = (30 + Math.random() * 30) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq * 0.25, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.3, now + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + Math.random() * 0.5);
        osc.connect(env); env.connect(out); osc.start(now); osc.stop(now + 1);
    },
    classic_tweeter: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 0.18 + Math.random() * 0.2;
        let freq = (3000 + Math.random() * 2500) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + dur);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.04, now + 0.04);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(env); env.connect(out); osc.start(now); osc.stop(now + dur);
    },
    classic_waterfall: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 3;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 8);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.2, now + 0.5);
        env.gain.setValueAtTime(0.2, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },

    // ===== DESERT WORLD =====

    desert_dune: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 4;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 8);
        const f = c.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(100, now);
        f.frequency.linearRampToValueAtTime(300, now + dur * 0.5);
        f.frequency.linearRampToValueAtTime(80, now + dur);
        f.Q.value = 0.5;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.1, now + dur * 0.3);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    desert_sidewinder: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
            const t = now + i * 0.15 + Math.random() * 0.05;
            const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.5);
            const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000; f.Q.value = 2;
            const g = c.createGain(); g.gain.setValueAtTime(0.06, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.08);
        }
    },

    // ===== ELEMENTAL WORLD =====

    elemental_tone: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 5;
        let freq = (200 + Math.random() * 600) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.12, now + 2);
        env.gain.setValueAtTime(0.12, now + dur - 2);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(env); env.connect(out); osc.start(now); osc.stop(now + dur);
    },
    elemental_overtone: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 3;
        let base = (100 + Math.random() * 200) * ps;
        if (recipe) base = quantizeToScale(base, recipe.baseFreq, recipe.toneScale);
        [1, 2, 3, 4, 5, 6].forEach((h, i) => {
            const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = base * h;
            const g = c.createGain();
            g.gain.setValueAtTime(0, now + i * 0.3);
            g.gain.linearRampToValueAtTime(0.06 / h, now + i * 0.3 + 0.5);
            g.gain.setValueAtTime(0.06 / h, now + dur - 0.3);
            g.gain.linearRampToValueAtTime(0, now + dur);
            osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + dur);
        });
    },
    elemental_spectre: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 3;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 6);
        const f = c.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.setValueAtTime(200 + Math.random() * 1000, now);
        f.frequency.exponentialRampToValueAtTime((200 + Math.random() * 1000) * 8, now + dur);
        f.Q.value = 15;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + 0.5);
        env.gain.setValueAtTime(0.15, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    elemental_dither: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 5 + Math.floor(Math.random() * 5); i++) {
            const t = now + Math.random() * 0.3;
            const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.2);
            const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 12000; f.Q.value = 5;
            const g = c.createGain(); g.gain.setValueAtTime(0.04, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.02);
        }
    },
    elemental_tremolo: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 3;
        let freq = (300 + Math.random() * 500) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const am = c.createOscillator(); const amG = c.createGain();
        am.frequency.value = 6 + Math.random() * 8; amG.gain.value = 0.5;
        am.connect(amG);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + 0.5);
        env.gain.setValueAtTime(0.15, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        amG.connect(env.gain);
        osc.connect(env); env.connect(out);
        osc.start(now); am.start(now); osc.stop(now + dur); am.stop(now + dur);
    },
    elemental_vibrato: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 4;
        let freq = (300 + Math.random() * 600) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
        const vib = c.createOscillator(); const vibG = c.createGain();
        vib.frequency.value = 4 + Math.random() * 4; vibG.gain.value = freq * 0.03;
        vib.connect(vibG); vibG.connect(osc.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.12, now + 0.5);
        env.gain.setValueAtTime(0.12, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(env); env.connect(out);
        osc.start(now); vib.start(now); osc.stop(now + dur); vib.stop(now + dur);
    },

    // ===== FOREST WORLD =====

    forest_ape: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const osc = c.createOscillator(); osc.type = 'sawtooth';
        const bf = (100 + Math.random() * 80) * ps;
        osc.frequency.setValueAtTime(bf, now);
        osc.frequency.linearRampToValueAtTime(bf * 1.8, now + 0.4);
        osc.frequency.linearRampToValueAtTime(bf, now + 0.9);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 2;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + 0.1);
        env.gain.setValueAtTime(0.15, now + 0.6);
        env.gain.exponentialRampToValueAtTime(0.001, now + 1);
        osc.connect(f); f.connect(env); env.connect(out); osc.start(now); osc.stop(now + 1);
    },
    forest_jaguar: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 0.5);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 3;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.2, now + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + 0.25);
    },

    // ===== INDUSTRIAL WORLD =====

    industrial_ground: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 3;
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 30 * ps;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 8); n.loop = true;
        const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 50;
        const nv = c.createGain(); nv.gain.value = 0.3;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 0.5 + Math.random() * 0.5; lfoG.gain.value = 0.3;
        lfo.connect(lfoG); lfoG.connect(nv.gain);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.12, now + 0.5);
        env.gain.setValueAtTime(0.12, now + dur - 0.5);
        env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(env); n.connect(nf); nf.connect(nv); nv.connect(env); env.connect(out);
        osc.start(now); n.start(now); lfo.start(now);
        osc.stop(now + dur); n.stop(now + dur); lfo.stop(now + dur);
    },

    // ===== LIMBIC WORLD =====

    limbic_heart: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const period = 60 / (70 + Math.random() * 30);
        for (let i = 0; i < 4; i++) {
            const t = now + i * period;
            const lub = c.createOscillator(); lub.type = 'sine'; lub.frequency.value = 50 * ps;
            const lubG = c.createGain();
            lubG.gain.setValueAtTime(0, t); lubG.gain.linearRampToValueAtTime(0.25, t + 0.04);
            lubG.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            lub.connect(lubG); lubG.connect(out); lub.start(t); lub.stop(t + 0.2);
            const dub = c.createOscillator(); dub.type = 'sine'; dub.frequency.value = 70 * ps;
            const dubG = c.createGain();
            dubG.gain.setValueAtTime(0, t + 0.18); dubG.gain.linearRampToValueAtTime(0.15, t + 0.22);
            dubG.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
            dub.connect(dubG); dubG.connect(out); dub.start(t + 0.18); dub.stop(t + 0.36);
        }
    },
    limbic_larynx: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random() * 2;
        let freq = (120 + Math.random() * 80) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        const s = synthFM(freq, freq * 2, freq * 0.5, 'sawtooth', now, dur, null);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq * 2; f.Q.value = 5;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 4);
        const ng = c.createGain(); ng.gain.value = 0.08;
        s.output.connect(f); n.connect(ng); ng.connect(f); f.connect(out);
        n.start(now); n.stop(now + dur);
    },
    limbic_lung: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 6);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 1;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + dur * 0.4);
        env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    limbic_nerve: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const rate = 4 + Math.random() * 8;
        for (let i = 0; i < Math.floor(rate * 2); i++) {
            const t = now + i * (1 / rate) + (Math.random() - 0.5) * 0.02;
            if (Math.random() < 0.6) {
                const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.1);
                const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000; f.Q.value = 3;
                const g = c.createGain(); g.gain.setValueAtTime(0.06, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
                n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.01);
            }
        }
    },
    limbic_vessel: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 4);
        const f = c.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.setValueAtTime(100, now);
        f.frequency.exponentialRampToValueAtTime(400, now + dur * 0.5);
        f.frequency.exponentialRampToValueAtTime(100, now + dur);
        f.Q.value = 3;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.12, now + dur * 0.2);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },

    // ===== MAINFRAME WORLD =====

    mainframe_keyboard: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const keyCount = 3 + Math.floor(Math.random() * 8);
        for (let i = 0; i < keyCount; i++) {
            const t = now + i * (0.05 + Math.random() * 0.1);
            const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.1);
            const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4000; f.Q.value = 2;
            const g = c.createGain(); g.gain.setValueAtTime(0.07, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
            n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.015);
        }
    },
    mainframe_modem: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const freqs = [1070, 1270, 2025, 2225];
        for (let i = 0; i < 6 + Math.floor(Math.random() * 8); i++) {
            const t = now + i * 0.06;
            const mf = freqs[Math.floor(Math.random() * freqs.length)] * ps;
            const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = mf;
            const g = c.createGain();
            g.gain.setValueAtTime(0.06, t); g.gain.setValueAtTime(0.06, t + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.06);
        }
    },
    mainframe_display: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random() * 2;
        const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 15734 * ps;
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 12000; f.Q.value = 3;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(0.03, now + 0.1);
        env.gain.setValueAtTime(0.03, now + dur - 0.1); env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(f); f.connect(env); env.connect(out); osc.start(now); osc.stop(now + dur);
    },
    mainframe_tape: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 3;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 6);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 1;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 8 + Math.random() * 4; lfoG.gain.value = 0.5;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(0.06, now + 0.2);
        env.gain.setValueAtTime(0.06, now + dur - 0.2); env.gain.linearRampToValueAtTime(0, now + dur);
        lfo.connect(lfoG); lfoG.connect(env.gain);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(now); lfo.start(now); n.stop(now + dur); lfo.stop(now + dur);
    },
    mainframe_widget: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        let freq = (800 + Math.random() * 1200) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = freq;
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 500;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(0.06, now + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(f); f.connect(env); env.connect(out); osc.start(now); osc.stop(now + 0.12);
    },
    mainframe_super: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 3 + Math.random() * 3;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 8);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 150; f.Q.value = 2;
        const lfo = c.createOscillator(); const lfoG = c.createGain();
        lfo.frequency.value = 2.5 + Math.random() * 2; lfoG.gain.value = 80;
        lfo.connect(lfoG); lfoG.connect(f.frequency);
        const env = c.createGain();
        env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(0.1, now + 0.5);
        env.gain.setValueAtTime(0.1, now + dur - 0.5); env.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(now); lfo.start(now); n.stop(now + dur); lfo.stop(now + dur);
    },

    // ===== MOUNTAIN WORLD =====

    mountain_gust: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 1 + Math.random() * 2;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('pink', 4);
        const f = c.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.setValueAtTime(600, now);
        f.frequency.linearRampToValueAtTime(2000, now + dur * 0.4);
        f.frequency.linearRampToValueAtTime(400, now + dur);
        f.Q.value = 0.8;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.25, now + dur * 0.3);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        n.connect(f); f.connect(env); env.connect(out); n.start(now); n.stop(now + dur);
    },
    mountain_quake: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const dur = 2 + Math.random() * 3;
        const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 6);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 80; f.Q.value = 1;
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 20 * ps;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(0.2, now + 0.3);
        env.gain.setValueAtTime(0.2, now + dur - 0.5); env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        n.connect(f); osc.connect(env); f.connect(env); env.connect(out);
        n.start(now); osc.start(now); n.stop(now + dur); osc.stop(now + dur);
    },

    // ===== PULSE WORLD =====

    pulse_grain: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        let freq = (200 + Math.random() * 800) * ps;
        if (recipe) freq = quantizeToScale(freq, recipe.baseFreq, recipe.toneScale);
        const dur = 0.02 + Math.random() * 0.08;
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.15, now + dur * 0.2);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(f); f.connect(env); env.connect(out); osc.start(now); osc.stop(now + dur);
    },

    // ===== TUNDRA WORLD =====

    tundra_hare: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime; const hopCount = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < hopCount; i++) {
            const t = now + i * 0.18;
            const n = c.createBufferSource(); n.buffer = createNoiseBuffer('brown', 0.5);
            const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200; f.Q.value = 1;
            const g = c.createGain(); g.gain.setValueAtTime(0.1, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.08);
        }
    },
    tundra_ox: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        const osc = c.createOscillator(); osc.type = 'sawtooth';
        const bf = (70 + Math.random() * 40) * ps;
        osc.frequency.setValueAtTime(bf, now);
        osc.frequency.linearRampToValueAtTime(bf * 0.6, now + 0.6);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 2;
        const env = c.createGain();
        env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(0.2, now + 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc.connect(f); f.connect(env); env.connect(out); osc.start(now); osc.stop(now + 0.7);
    },
    tundra_snow: (c, out, ps) => { ps = ps || 1;
        const now = c.currentTime;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
            const t = now + i * 0.25 + Math.random() * 0.05;
            const n = c.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.5);
            const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000; f.Q.value = 1;
            const g = c.createGain(); g.gain.setValueAtTime(0.06, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.1);
        }
    },

    // ===== NOTE FLURRY — very fast random note burst, like a music box winding down =====

    note_flurry: (c, out, ps) => {
        ps = ps || 1;
        const now = c.currentTime;
        const scale = recipe ? recipe.arpScale : [0, 3, 7, 10, 12];
        const baseFreq = (recipe ? recipe.baseFreq * 2 : 440) * ps;

        // 6-16 notes spread over 0.5-1.5s, getting slower (accelerando → ritardando)
        const noteCount = 6 + Math.floor(Math.random() * 11);
        const totalDur = 0.5 + Math.random();
        let cursor = 0;

        for (let i = 0; i < noteCount; i++) {
            // Notes start fast and slow down (or vice versa)
            const progress = i / noteCount;
            const accel = Math.random() > 0.5;
            const spacing = accel
                ? totalDur / noteCount * (0.3 + progress * 1.7)   // accelerating gaps
                : totalDur / noteCount * (2 - progress * 1.7);     // decelerating gaps
            cursor += spacing;

            const t = now + cursor;
            const semi = scale[Math.floor(Math.random() * scale.length)];
            const octave = Math.floor(Math.random() * 2);
            const freq = baseFreq * Math.pow(2, (semi + octave * 12) / 12);

            const osc = c.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const g = c.createGain();
            // Velocity varies per note
            const vel = 0.06 + Math.random() * 0.1;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(vel, t + 0.005); // ultra fast attack
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15 + Math.random() * 0.3);

            osc.connect(g); g.connect(out);
            osc.start(t); osc.stop(t + 0.5);
        }
    }
};

// ========== PROPS LAYER (3D) ==========

function createPropsLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.7 * Math.max(0.4, params.density);
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    if (!r.props || r.props.length === 0) return layer;
    const availableProps = r.props;

    function spawn() {
        if (!isPlaying) return;
        const name = availableProps[Math.floor(Math.random() * availableProps.length)];
        spawnProp3D(name, mainGain);
    }

    // Initial burst of spawns — fill the space immediately
    for (let i = 0; i < 6; i++) {
        setTimeout(() => { if (isPlaying) spawn(); }, i * 300 + Math.random() * 500);
    }

    // Continuous spawning — much more frequent
    const interval = setInterval(() => {
        if (!isPlaying) return;
        spawn();
        // Sometimes spawn 2 at once for density
        if (Math.random() < params.density * 0.6) spawn();
    }, 1200 + Math.random() * 800 / Math.max(0.2, params.density));

    layer.intervals.push(interval);
    layer.gains.push(mainGain);
    return layer;
}

// ========== PAD LAYER (Lush sustained chords) ==========

function pickChordTones(scale, count) {
    const indices = [];
    const available = [...Array(scale.length).keys()];
    for (let i = 0; i < Math.min(count, scale.length); i++) {
        const idx = Math.floor(Math.random() * available.length);
        indices.push(available.splice(idx, 1)[0]);
    }
    return indices.map(i => scale[i]);
}

function createPadLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.25 * params.depth;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    let currentVoices = [];

    function playChord() {
        if (!isPlaying) return;

        // Fade out old voices over 3s
        currentVoices.forEach(v => {
            if (v.gain) {
                v.gain.gain.cancelScheduledValues(ctx.currentTime);
                v.gain.gain.setValueAtTime(v.gain.gain.value, ctx.currentTime);
                v.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);
            }
            v.nodes.forEach(n => { try { n.stop(ctx.currentTime + 3.1); } catch(e){} });
        });
        currentVoices = [];

        const chordSize = 3 + Math.floor(Math.random() * 2);
        const semitones = pickChordTones(r.toneScale, chordSize);
        const octave = Math.floor(Math.random() * 2);

        semitones.forEach((semi, i) => {
            const freq = r.baseFreq * Math.pow(2, (semi + octave * 12) / 12);
            const now = ctx.currentTime;

            const osc1 = ctx.createOscillator();
            osc1.type = 'triangle';
            osc1.frequency.value = freq;

            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.value = freq * 1.002;

            const vib = ctx.createOscillator();
            const vibG = ctx.createGain();
            vib.frequency.value = 0.3 + Math.random() * 0.4;
            vibG.gain.value = freq * 0.003;
            vib.connect(vibG);
            vibG.connect(osc1.frequency);
            vibG.connect(osc2.frequency);

            const lpf = ctx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.value = Math.min(freq * 4, r.filterBase * 2);
            lpf.Q.value = 0.7;

            const voiceGain = ctx.createGain();
            const attackTime = 2 + Math.random() * 2;
            const level = 0.15 / chordSize;
            voiceGain.gain.setValueAtTime(0, now);
            voiceGain.gain.linearRampToValueAtTime(level, now + attackTime);

            const angle = (i / chordSize) * Math.PI * 2;
            const radius = 3 + Math.random() * 2;
            const panner = createHRTF(Math.cos(angle) * radius, (Math.random() - 0.5) * 2, Math.sin(angle) * radius);
            createSpatialSource(panner, 'hover', 999);

            osc1.connect(lpf);
            osc2.connect(lpf);
            lpf.connect(voiceGain);
            connectHRTF(voiceGain, panner, mainGain);

            osc1.start(); osc2.start(); vib.start();
            layer.nodes.push(osc1, osc2, vib);

            currentVoices.push({ gain: voiceGain, nodes: [osc1, osc2, vib] });
        });
    }

    playChord();
    const chordInterval = setInterval(playChord, 8000 + Math.random() * 7000);
    layer.intervals.push(chordInterval);
    layer.gains.push(mainGain);
    return layer;
}

// ========== HIGHWAY LAYER (Gliding synth lines) ==========

function createHighwayLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.4 * Math.max(0.4, params.brightness);
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const voiceCount = 1 + Math.floor(Math.random() * 2);

    for (let v = 0; v < voiceCount; v++) {
        const scale = r.toneScale;
        const octave = v;
        let currentSemi = scale[Math.floor(Math.random() * scale.length)];
        let freq = r.baseFreq * Math.pow(2, (currentSemi + octave * 12) / 12);

        const osc = ctx.createOscillator();
        osc.type = v === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.value = freq;

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 1.003;

        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = freq * 3;
        lpf.Q.value = 1.5;

        const filterLfo = ctx.createOscillator();
        const filterLfoG = ctx.createGain();
        filterLfo.frequency.value = 0.1 + Math.random() * 0.2;
        filterLfoG.gain.value = freq * 2;
        filterLfo.connect(filterLfoG);
        filterLfoG.connect(lpf.frequency);

        const voiceGain = ctx.createGain();
        voiceGain.gain.setValueAtTime(0, ctx.currentTime);
        voiceGain.gain.linearRampToValueAtTime(0.12 / voiceCount, ctx.currentTime + 2);

        const panner = createHRTF(0, 0, 0);
        const mvType = ['flyby', 'passby', 'orbit', 'spiral'][Math.floor(Math.random() * 4)];
        createSpatialSource(panner, mvType, 999);

        osc.connect(lpf);
        osc2.connect(lpf);
        lpf.connect(voiceGain);
        connectHRTF(voiceGain, panner, mainGain);

        osc.start(); osc2.start(); filterLfo.start();
        layer.nodes.push(osc, osc2, filterLfo);

        const glideInterval = setInterval(() => {
            if (!isPlaying) return;
            const currentIdx = scale.indexOf(currentSemi);
            let nextIdx;
            if (currentIdx >= 0) {
                const step = Math.random() > 0.3 ? (Math.random() > 0.5 ? 1 : -1) : Math.floor(Math.random() * scale.length);
                nextIdx = (currentIdx + step + scale.length) % scale.length;
            } else {
                nextIdx = Math.floor(Math.random() * scale.length);
            }
            currentSemi = scale[nextIdx];
            freq = r.baseFreq * Math.pow(2, (currentSemi + octave * 12) / 12);

            const glideTime = 1 + Math.random() * 2;
            osc.frequency.cancelScheduledValues(ctx.currentTime);
            osc.frequency.setValueAtTime(osc.frequency.value, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq), ctx.currentTime + glideTime);
            osc2.frequency.cancelScheduledValues(ctx.currentTime);
            osc2.frequency.setValueAtTime(osc2.frequency.value, ctx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 1.003), ctx.currentTime + glideTime);

            lpf.frequency.cancelScheduledValues(ctx.currentTime);
            lpf.frequency.setValueAtTime(lpf.frequency.value, ctx.currentTime);
            lpf.frequency.linearRampToValueAtTime(Math.max(100, freq * 3), ctx.currentTime + glideTime);
        }, 2000 + Math.random() * 3000);

        layer.intervals.push(glideInterval);
    }

    layer.gains.push(mainGain);
    return layer;
}

// ========== MELODIC ARP LAYER (Musical interlocking arpeggios) ==========

function createMelodicArpLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.25 * Math.max(0.3, params.brightness);
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const scale = r.arpScale || r.toneScale;
    const baseSpeed = r.arpSpeed || 0.3;
    const voiceCount = 2 + Math.floor(Math.random() * 2);
    const patterns = ['ascending', 'descending', 'pendulum', 'random_walk'];

    for (let v = 0; v < voiceCount; v++) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        const octave = v;
        const speedMult = [1, 1.5, 2][v] || 1;
        const bpm = (80 + baseSpeed * 80) * speedMult * Math.max(0.3, params.modSpeed);

        let noteIdx = Math.floor(Math.random() * scale.length);
        let dir = 1;

        const angle = (v / voiceCount) * Math.PI * 2;
        const radius = 4 + v * 2;
        const panner = createHRTF(Math.cos(angle) * radius, v * 1.5, Math.sin(angle) * radius);
        panner.connect(mainGain);
        createSpatialSource(panner, 'orbit', 999).speed = 0.2 + v * 0.1;

        function playArpNote() {
            if (!isPlaying) return;

            const semi = scale[noteIdx] + octave * 12;
            const freq = r.baseFreq * Math.pow(2, semi / 12);

            const osc = ctx.createOscillator();
            osc.type = ['sine', 'triangle'][v % 2];
            osc.frequency.value = freq;

            const lpf = ctx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.value = Math.max(200, freq * 3 * params.brightness);
            lpf.Q.value = 1;

            const noteDur = (60 / bpm) * 0.9;
            const g = ctx.createGain();
            const noteVol = 0.15 / voiceCount;
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(noteVol, ctx.currentTime + 0.02);
            g.gain.setValueAtTime(noteVol * 0.8, ctx.currentTime + noteDur * 0.6);
            g.gain.linearRampToValueAtTime(0, ctx.currentTime + noteDur);

            osc.connect(lpf);
            lpf.connect(g);
            g.connect(panner);
            osc.start();
            osc.stop(ctx.currentTime + noteDur + 0.05);

            switch (pattern) {
                case 'ascending':
                    noteIdx = (noteIdx + 1) % scale.length;
                    break;
                case 'descending':
                    noteIdx = (noteIdx - 1 + scale.length) % scale.length;
                    break;
                case 'pendulum':
                    noteIdx += dir;
                    if (noteIdx >= scale.length - 1) dir = -1;
                    if (noteIdx <= 0) dir = 1;
                    noteIdx = Math.max(0, Math.min(scale.length - 1, noteIdx));
                    break;
                case 'random_walk':
                    noteIdx += (Math.random() > 0.5 ? 1 : -1);
                    noteIdx = (noteIdx + scale.length) % scale.length;
                    break;
            }
        }

        const arpInterval = setInterval(playArpNote, 60000 / bpm);
        layer.intervals.push(arpInterval);
        playArpNote();
    }

    layer.gains.push(mainGain);
    return layer;
}

// ========== CHORDAL LAYER (Slow chord progressions) ==========

function createChordalLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.18 * params.depth;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const scale = r.toneScale;
    let rootIdx = 0;

    function buildTriad(rootScaleIdx) {
        const tones = [];
        tones.push(scale[rootScaleIdx % scale.length]);
        tones.push(scale[(rootScaleIdx + 2) % scale.length]);
        tones.push(scale[(rootScaleIdx + 4) % scale.length]);
        if (Math.random() > 0.5 && scale.length > 4) {
            tones.push(scale[(rootScaleIdx + 5) % scale.length]);
        }
        return tones;
    }

    let activeVoices = [];

    function playProgression() {
        if (!isPlaying) return;

        const fadeTime = 4;
        activeVoices.forEach(v => {
            if (v.envGain) {
                v.envGain.gain.cancelScheduledValues(ctx.currentTime);
                v.envGain.gain.setValueAtTime(v.envGain.gain.value, ctx.currentTime);
                v.envGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeTime);
            }
            v.oscs.forEach(o => { try { o.stop(ctx.currentTime + fadeTime + 0.1); } catch(e){} });
        });
        activeVoices = [];

        const triad = buildTriad(rootIdx);
        const octave = Math.floor(Math.random() * 2);
        const now = ctx.currentTime;

        triad.forEach((semi, i) => {
            const freq = r.baseFreq * Math.pow(2, (semi + octave * 12) / 12);

            const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = freq;
            const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = freq * 1.001;

            const vib = ctx.createOscillator();
            const vibG = ctx.createGain();
            vib.frequency.value = 0.2 + Math.random() * 0.3;
            vibG.gain.value = freq * 0.002;
            vib.connect(vibG); vibG.connect(osc1.frequency); vibG.connect(osc2.frequency);

            const envGain = ctx.createGain();
            envGain.gain.setValueAtTime(0, now);
            envGain.gain.linearRampToValueAtTime(0.1 / triad.length, now + fadeTime);

            const angle = (i / triad.length) * Math.PI * 2;
            const panner = createHRTF(Math.cos(angle) * 4, (Math.random() - 0.5) * 2, Math.sin(angle) * 4);
            createSpatialSource(panner, 'hover', 999);

            osc1.connect(envGain); osc2.connect(envGain);
            connectHRTF(envGain, panner, mainGain);

            osc1.start(); osc2.start(); vib.start();
            layer.nodes.push(osc1, osc2, vib);

            activeVoices.push({ envGain, oscs: [osc1, osc2, vib] });
        });

        const movements = [1, 2, 3, -1, -2, 4];
        const move = movements[Math.floor(Math.random() * movements.length)];
        rootIdx = (rootIdx + move + scale.length) % scale.length;
    }

    playProgression();
    const chordInterval = setInterval(playProgression, 6000 + Math.random() * 6000);
    layer.intervals.push(chordInterval);

    layer.gains.push(mainGain);
    return layer;
}

// ========== POLYRHYTHM LAYER (Interlocking rhythmic patterns) ==========

function createPolyrhythmLayer(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.3;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    // Master tempo derived from recipe
    const baseBPM = 70 + (r.arpSpeed || 0.3) * 80 + params.movement * 30;

    // Beat divisions — pick 3 or 4 from these for polyrhythmic interplay
    const allDivisions = [3, 4, 5, 7];
    const divCount = 3 + Math.floor(Math.random() * 2); // 3 or 4 voices
    const shuffled = allDivisions.sort(() => Math.random() - 0.5);
    const divisions = shuffled.slice(0, divCount);

    // Scale tones for pitched percussion — pick from recipe
    const scale = r.toneScale || [0, 3, 5, 7, 10];
    const baseFreq = r.baseFreq || 110;

    // Voice timbres for each division
    const timbres = [
        // Low resonant hit
        (c, out, freq) => {
            const now = c.currentTime;
            const osc = c.createOscillator(); osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.15);
            const g = c.createGain();
            g.gain.setValueAtTime(0.25, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + 0.2);
        },
        // Mid click / woodblock-ish
        (c, out, freq) => {
            const now = c.currentTime;
            const osc = c.createOscillator(); osc.type = 'triangle';
            osc.frequency.value = freq * 2;
            const f = c.createBiquadFilter(); f.type = 'bandpass';
            f.frequency.value = freq * 2; f.Q.value = 8;
            const g = c.createGain();
            g.gain.setValueAtTime(0.2, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(f); f.connect(g); g.connect(out); osc.start(now); osc.stop(now + 0.08);
        },
        // High bell ping
        (c, out, freq) => {
            const now = c.currentTime;
            const osc = c.createOscillator(); osc.type = 'sine';
            osc.frequency.value = freq * 4;
            const osc2 = c.createOscillator(); osc2.type = 'sine';
            osc2.frequency.value = freq * 4 * 2.76;
            const g = c.createGain();
            g.gain.setValueAtTime(0.12, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            const g2 = c.createGain();
            g2.gain.setValueAtTime(0.05, now);
            g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(g); osc2.connect(g2); g.connect(out); g2.connect(out);
            osc.start(now); osc2.start(now); osc.stop(now + 0.4); osc2.stop(now + 0.2);
        },
        // FM metallic tap
        (c, out, freq) => {
            const now = c.currentTime;
            const carrier = c.createOscillator(); carrier.type = 'sine';
            carrier.frequency.value = freq * 3;
            const mod = c.createOscillator(); mod.type = 'sine';
            mod.frequency.value = freq * 3 * 1.41;
            const modG = c.createGain(); modG.gain.value = freq * 3 * 0.5;
            mod.connect(modG); modG.connect(carrier.frequency);
            const g = c.createGain();
            g.gain.setValueAtTime(0.1, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            carrier.connect(g); g.connect(out);
            carrier.start(now); mod.start(now);
            carrier.stop(now + 0.12); mod.stop(now + 0.12);
        }
    ];

    // Create each polyrhythmic voice
    divisions.forEach((div, idx) => {
        // Spatial position — spread voices around the listener
        const angle = (idx / divisions.length) * Math.PI * 2;
        const panner = createHRTF(Math.cos(angle) * 3, 0.5, Math.sin(angle) * 3);
        panner.connect(mainGain);
        createSpatialSource(panner, 'hover', 999);

        const timbre = timbres[idx % timbres.length];
        // Pick a scale tone for this voice
        const semitone = scale[idx % scale.length];
        const voiceFreq = baseFreq * Math.pow(2, (semitone + 12) / 12); // one octave up

        // The interval for this voice: one beat-cycle divided by this voice's division
        // One "cycle" = one bar at baseBPM (4 beats)
        const barDuration = (60 / baseBPM) * 4; // seconds per bar
        const voiceInterval = (barDuration / div) * 1000; // ms between hits

        let beatIdx = 0;

        function hit() {
            if (!isPlaying) return;
            // Accent pattern: first beat of each cycle louder
            timbre(ctx, panner, voiceFreq);
            beatIdx++;
        }

        // Stagger start slightly so voices don't all begin at exactly the same time
        const stagger = idx * 50;
        setTimeout(() => {
            if (!isPlaying) return;
            hit();
            const iv = setInterval(hit, voiceInterval);
            layer.intervals.push(iv);
        }, stagger);
    });

    layer.gains.push(mainGain);
    return layer;
}

// ========== TRANCE SYSTEM ==========

function genKickPat() { return [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]; }
function genHatPat() {
    const p = new Array(16).fill(0);
    [2,6,10,14].forEach(i => { p[i] = 1; });
    [0,4,8,12].forEach(i => { if (Math.random() < 0.3) p[i] = 0.5; });
    [1,3,5,7,9,11,13,15].forEach(i => { if (Math.random() < 0.15) p[i] = 0.3; });
    return p;
}
function genBassPat(scale, root) {
    const p = new Array(16).fill(null);
    p[0] = { freq: root * 0.5, vel: 1 };
    [4,8,12].forEach(i => { if (Math.random() < 0.6) p[i] = { freq: root * 0.5 * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12), vel: 0.7 }; });
    [2,6,10,14].forEach(i => { if (Math.random() < 0.25) p[i] = { freq: root * 0.5 * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12), vel: 0.5 }; });
    return p;
}
function genArpPat(scale, root) {
    const p = new Array(16).fill(null);
    let ni = 0;
    for (let i = 0; i < 16; i++) {
        if (Math.random() < 0.55) {
            p[i] = { freq: root * Math.pow(2, (scale[ni % scale.length] + 12) / 12), vel: 0.5 + Math.random() * 0.5 };
            ni += Math.random() > 0.4 ? 1 : 2;
        }
    }
    return p;
}
function genPadPat(scale, root) {
    return [scale[0], scale[2 % scale.length], scale[4 % scale.length]].map(s => root * Math.pow(2, s / 12));
}
function genTremPat(scale, root) {
    const p = new Array(16).fill(null);
    const freq = root * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12);
    for (let i = 0; i < 16; i++) {
        if (Math.random() < 0.45) p[i] = { freq, vel: 0.3 + Math.random() * 0.4 };
    }
    return p;
}

function scheduleTKick(step, when, out) {
    if (step % 4 !== 0) return;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(180, when);
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.15);
    const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('brown', 0.5);
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 100;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.3, when); ng.gain.exponentialRampToValueAtTime(0.001, when + 0.08);
    const env = ctx.createGain(); env.gain.setValueAtTime(0.8, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
    osc.connect(env); env.connect(out); n.connect(nf); nf.connect(ng); ng.connect(out);
    osc.start(when); osc.stop(when + 0.3); n.start(when); n.stop(when + 0.08);
}
function scheduleTHat(step, when, out) {
    if (step % 2 !== 0) return;
    const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.2);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000; f.Q.value = 2;
    const dur = step % 4 === 2 ? 0.08 : 0.04;
    const env = ctx.createGain(); env.gain.setValueAtTime(step % 4 === 2 ? 0.3 : 0.15, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    n.connect(f); f.connect(env); env.connect(out); n.start(when); n.stop(when + 0.1);
}
function scheduleTBass(step, when, out, pattern, stepTime) {
    const note = pattern[step]; if (!note) return;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(note.freq, when);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 280 + note.vel * 150; f.Q.value = 1.2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when); env.gain.linearRampToValueAtTime(note.vel * 0.32, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, when + stepTime * 1.5);
    osc.connect(f); f.connect(env); env.connect(out); osc.start(when); osc.stop(when + stepTime * 2);
}
function scheduleTArp(step, when, out, pattern, stepTime) {
    const note = pattern[step]; if (!note) return;
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = note.freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = note.freq * 3; f.Q.value = 1;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when); env.gain.linearRampToValueAtTime(note.vel * 0.25, when + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, when + stepTime * 1.2);
    osc.connect(f); f.connect(env); env.connect(out); osc.start(when); osc.stop(when + stepTime * 1.5);
}
function scheduleTBPad(step, when, out, chordFreqs, stepTime) {
    if (step !== 0) return;
    const barTime = stepTime * 16;
    chordFreqs.forEach(freq => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = freq * 2;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when); env.gain.linearRampToValueAtTime(0.06 / chordFreqs.length, when + 0.5);
        env.gain.setValueAtTime(0.06 / chordFreqs.length, when + barTime - 0.5);
        env.gain.linearRampToValueAtTime(0, when + barTime);
        osc.connect(env); osc2.connect(env); env.connect(out);
        osc.start(when); osc2.start(when); osc.stop(when + barTime); osc2.stop(when + barTime);
    });
}
function scheduleTTrem(step, when, out, pattern, stepTime) {
    const note = pattern[step]; if (!note) return;
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = note.freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = Math.min(note.freq * 4, 2000); f.Q.value = 0.7;
    const am = ctx.createOscillator(); am.type = 'sine';
    const amG = ctx.createGain();
    am.frequency.value = 6; amG.gain.value = 0.25; am.connect(amG);
    const env = ctx.createGain(); env.gain.value = 0;
    amG.connect(env.gain);
    const peak = note.vel * 0.07;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, when + stepTime * 2);
    osc.connect(f); f.connect(env); env.connect(out);
    osc.start(when); am.start(when); osc.stop(when + stepTime * 2.5); am.stop(when + stepTime * 2.5);
}

function createTranceSystem(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.8;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const bpm = r.bpm || 128;
    const stepTime = 60 / bpm / 4; // 16th note duration
    const scale = r.toneScale || [0, 2, 4, 7, 9];
    const root = r.baseFreq;

    // Per-voice gains
    const vg = {};
    ['kick', 'hat', 'bass', 'arp', 'pad', 'trem'].forEach(k => {
        const g = ctx.createGain(); g.gain.value = 0; g.connect(mainGain); vg[k] = g;
    });

    // Patterns (regenerated periodically)
    let patterns = {
        kick: genKickPat(), hat: genHatPat(),
        bass: genBassPat(scale, root), arp: genArpPat(scale, root),
        pad: genPadPat(scale, root), trem: genTremPat(scale, root)
    };

    // Fade in voices staggered
    [['kick',1,0.1],['hat',0.6,0.5],['bass',0.8,1],['arp',0.7,2]].forEach(([k,v,d]) => {
        setTimeout(() => { if (isPlaying) { vg[k].gain.cancelScheduledValues(ctx.currentTime); vg[k].gain.linearRampToValueAtTime(v, ctx.currentTime + 2); } }, d * 1000);
    });

    let stepIdx = 0, barCount = 0;
    let nextStepTime = ctx.currentTime + 0.05;

    const schedulerInterval = setInterval(() => {
        if (!isPlaying) return;
        while (nextStepTime < ctx.currentTime + 0.12) {
            const step16 = stepIdx % 16;

            if (step16 === 0) {
                barCount++;
                // Toggle a voice every 4-8 bars
                if (barCount % (4 + Math.floor(Math.random() * 4)) === 0) {
                    const tv = ['arp', 'pad', 'trem'][Math.floor(Math.random() * 3)];
                    const cur = vg[tv].gain.value;
                    const target = cur < 0.3 ? (0.5 + Math.random() * 0.5) : 0;
                    vg[tv].gain.cancelScheduledValues(nextStepTime);
                    vg[tv].gain.setValueAtTime(vg[tv].gain.value, nextStepTime);
                    vg[tv].gain.linearRampToValueAtTime(target, nextStepTime + stepTime * 16);
                }
                // Regenerate a pattern every 8-16 bars
                if (barCount % (8 + Math.floor(Math.random() * 8)) === 0) {
                    const pv = ['bass', 'arp', 'trem'][Math.floor(Math.random() * 3)];
                    if (pv === 'bass') patterns.bass = genBassPat(scale, root);
                    else if (pv === 'arp') patterns.arp = genArpPat(scale, root);
                    else patterns.trem = genTremPat(scale, root);
                }
            }

            scheduleTKick(step16, nextStepTime, vg.kick);
            scheduleTHat(step16, nextStepTime, vg.hat);
            scheduleTBass(step16, nextStepTime, vg.bass, patterns.bass, stepTime);
            scheduleTArp(step16, nextStepTime, vg.arp, patterns.arp, stepTime);
            scheduleTBPad(step16, nextStepTime, vg.pad, patterns.pad, stepTime);
            scheduleTTrem(step16, nextStepTime, vg.trem, patterns.trem, stepTime);

            stepIdx++;
            nextStepTime += stepTime;
        }
    }, 25);

    layer.intervals.push(schedulerInterval);
    layer.gains.push(mainGain);
    return layer;
}

// ========== LOFI SYSTEM ==========
// Slow, jazzy hip-hop. Soft kick + swung hats + warm bass + Rhodes-like 7th chord stabs.

function lofiPickChordRoots(scale) {
    // Pick 4 chord roots (degree indices into scale) for an i-vi-ii-V-ish progression
    const allowed = [0, 2, 3, 4, 5];
    const prog = [];
    for (let i = 0; i < 4; i++) prog.push(allowed[Math.floor(Math.random() * allowed.length)]);
    prog[0] = 0; // anchor on tonic
    return prog;
}
function lofiChordFreqs(rootDegIdx, scale, root) {
    // Build a 7th chord: root, +2 in scale, +4 in scale, +6 in scale
    const out = [];
    for (let i = 0; i < 4; i++) {
        const idx = rootDegIdx + i * 2;
        const semis = scale[idx % scale.length] + 12 * Math.floor(idx / scale.length);
        out.push(root * Math.pow(2, semis / 12));
    }
    return out;
}

function lofiKick(when, out) {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(110, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.55, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.28);
    osc.connect(env); env.connect(out);
    osc.start(when); osc.stop(when + 0.3);
}
function lofiHat(when, out, vel) {
    const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.15);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500; f.Q.value = 1;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vel * 0.12, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    n.connect(f); f.connect(env); env.connect(out);
    n.start(when); n.stop(when + 0.1);
}
function lofiSnare(when, out) {
    const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.2);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.9;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.22, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
    n.connect(f); f.connect(env); env.connect(out);
    n.start(when); n.stop(when + 0.2);
}
function lofiBass(when, out, freq, dur) {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.32, when + 0.015);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(env); osc2.connect(g2); g2.connect(env); env.connect(out);
    osc.start(when); osc2.start(when); osc.stop(when + dur + 0.05); osc2.stop(when + dur + 0.05);
}
function lofiRhodesNote(when, out, freq, dur, vel) {
    // Layered Rhodes-ish: sine fundamental + triangle 2nd + soft 3rd harmonic bell
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2;
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = freq * 3;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const g3 = ctx.createGain(); g3.gain.value = 0.12;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(freq * 8, 4500), when);
    f.frequency.exponentialRampToValueAtTime(Math.min(freq * 4, 2200), when + dur * 0.6);
    f.Q.value = 0.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.55, when + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o1.connect(env); o2.connect(g2); g2.connect(env); o3.connect(g3); g3.connect(env);
    env.connect(f); f.connect(out);
    o1.start(when); o2.start(when); o3.start(when);
    const stopAt = when + dur + 0.05;
    o1.stop(stopAt); o2.stop(stopAt); o3.stop(stopAt);
}

function createLofiSystem(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain(); mainGain.gain.value = 0.85;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    // Subtle vinyl crackle through mainGain
    const crackle = ctx.createBufferSource(); crackle.buffer = createNoiseBuffer('pink', 4); crackle.loop = true;
    const crackleF = ctx.createBiquadFilter(); crackleF.type = 'highpass'; crackleF.frequency.value = 3000;
    const crackleG = ctx.createGain(); crackleG.gain.value = 0.04;
    crackle.connect(crackleF); crackleF.connect(crackleG); crackleG.connect(mainGain);
    crackle.start(); layer.nodes.push(crackle); layer.gains.push(crackleG);

    const bpm = r.bpm || 78;
    const stepTime = 60 / bpm / 4; // 16th
    const swing = 0.18; // delay every 2nd 16th
    const scale = r.toneScale || [0, 2, 3, 5, 7, 8, 10];
    const root = r.baseFreq;

    let prog = lofiPickChordRoots(scale);
    // Melody: pick a sparse melodic pattern across 16 steps using scale degrees
    const buildMelody = () => {
        const m = new Array(16).fill(null);
        const candidateSteps = [2, 6, 10, 14, 3, 11, 7];
        candidateSteps.forEach(idx => {
            if (Math.random() < 0.55) {
                const deg = Math.floor(Math.random() * scale.length);
                const oct = Math.random() < 0.7 ? 1 : 2;
                m[idx] = root * Math.pow(2, (scale[deg] + 12 * oct) / 12);
            }
        });
        return m;
    };
    let melody = buildMelody();
    let stepIdx = 0, barCount = 0;
    let nextStepTime = ctx.currentTime + 0.05;

    const interval = setInterval(() => {
        if (!isPlaying) return;
        while (nextStepTime < ctx.currentTime + 0.15) {
            const s = stepIdx % 16;
            const swingOff = (s % 2 === 1) ? stepTime * swing : 0;
            const t = nextStepTime + swingOff;

            if (s === 0) {
                barCount++;
                if (barCount % 4 === 1) prog = lofiPickChordRoots(scale);
                if (barCount % 2 === 1) melody = buildMelody();
            }

            // Drums
            if (s === 0 || s === 8) lofiKick(t, mainGain);
            if (s === 4 || s === 12) lofiSnare(t, mainGain);
            if (s % 2 === 0) lofiHat(t, mainGain, s % 4 === 0 ? 0.7 : 1.0);
            if (s === 7 && Math.random() < 0.25) lofiHat(t, mainGain, 0.6);

            // Chord stab on beat 1 of each chord (every 4 steps = quarter note)
            if (s % 4 === 0) {
                const chordIdx = (s / 4) % 4;
                const chordFreqs = lofiChordFreqs(prog[chordIdx], scale, root * 2);
                chordFreqs.forEach((f, i) => {
                    if (i === 0 || Math.random() < 0.85) {
                        lofiRhodesNote(t + Math.random() * 0.01, mainGain, f, stepTime * 6, 0.5 - i * 0.08);
                    }
                });
                // Bass note follows chord root, lower octave
                const bassFreq = root * Math.pow(2, scale[prog[chordIdx] % scale.length] / 12) * 0.5;
                lofiBass(t, mainGain, bassFreq, stepTime * 3.5);
            }

            // Melody on top
            if (melody[s]) {
                lofiRhodesNote(t, mainGain, melody[s], stepTime * 3, 0.6);
            }

            stepIdx++;
            nextStepTime += stepTime;
        }
    }, 25);

    layer.intervals.push(interval);
    layer.gains.push(mainGain);
    return layer;
}

// ========== BERLIN SCHOOL SYSTEM ==========
// Sequenced 16th-note arpeggio with slow filter sweep + drifting pad.

function berlinGenSeq(scale, root, len) {
    const seq = [];
    for (let i = 0; i < len; i++) {
        const oct = Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? -12 : 12);
        const semis = scale[Math.floor(Math.random() * scale.length)] + oct;
        seq.push(root * Math.pow(2, semis / 12));
    }
    // Make sure first note is the root for stability
    seq[0] = root;
    return seq;
}

function berlinSeqNote(when, out, freq, stepTime, filterFreq) {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq, when);
    f.Q.value = 6;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.18, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, when + stepTime * 0.9);
    osc.connect(f); f.connect(env); env.connect(out);
    osc.start(when); osc.stop(when + stepTime);
}
function berlinKick(when, out) {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(120, when);
    osc.frequency.exponentialRampToValueAtTime(38, when + 0.18);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.5, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.32);
    osc.connect(env); env.connect(out);
    osc.start(when); osc.stop(when + 0.35);
}
function berlinLeadNote(when, out, freq, dur, vel) {
    // Soft analog-ish lead: detuned saws through resonant lowpass, slow attack
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.007;
    const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = freq * 2;
    const g3 = ctx.createGain(); g3.gain.value = 0.18;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(freq * 2, 1200), when);
    f.frequency.linearRampToValueAtTime(Math.min(freq * 5, 3500), when + 0.08);
    f.frequency.exponentialRampToValueAtTime(Math.min(freq * 2, 1500), when + dur * 0.7);
    f.Q.value = 4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.16, when + 0.05);
    env.gain.setValueAtTime(vel * 0.16, when + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o1.connect(env); o2.connect(env); o3.connect(g3); g3.connect(env);
    env.connect(f); f.connect(out);
    o1.start(when); o2.start(when); o3.start(when);
    const stopAt = when + dur + 0.05;
    o1.stop(stopAt); o2.stop(stopAt); o3.stop(stopAt);
}
function berlinSubBass(when, out, freq, dur) {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.32, when + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(f); f.connect(env); env.connect(out);
    osc.start(when); osc.stop(when + dur + 0.05);
}
function berlinGenMelody(scale, root) {
    // 32-step (2 bars of 16ths) sparse melody — half/quarter notes mostly on strong beats
    const m = new Array(32).fill(null);
    const candidateSteps = [0, 4, 8, 12, 16, 20, 24, 28, 6, 14, 22, 30];
    candidateSteps.forEach(idx => {
        if (Math.random() < 0.55) {
            const deg = scale[Math.floor(Math.random() * scale.length)];
            const oct = Math.random() < 0.6 ? 2 : (Math.random() < 0.5 ? 1 : 3);
            m[idx] = root * Math.pow(2, (deg + 12 * oct) / 12);
        }
    });
    m[0] = root * Math.pow(2, (scale[0] + 24) / 12);
    return m;
}
function berlinGenBassLine(scale, root, len) {
    // One bass note per bar (16 steps), root-driven walking line
    const bars = Math.max(2, Math.floor(len / 8));
    const line = [];
    const choices = [0, 0, 0, 4, 3, 5, 2];
    for (let i = 0; i < bars; i++) {
        const deg = choices[Math.floor(Math.random() * choices.length)];
        const semis = scale[deg % scale.length];
        line.push(root * 0.5 * Math.pow(2, semis / 12));
    }
    line[0] = root * 0.5;
    return line;
}

function createBerlinSystem(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain(); mainGain.gain.value = 0.75;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const bpm = r.bpm || 108;
    const stepTime = 60 / bpm / 4;
    const scale = r.toneScale || [0, 2, 3, 5, 7, 8, 10];
    const root = r.baseFreq * 2; // bring up to a usable arp register
    const seqLen = [8, 16][Math.floor(Math.random() * 2)];
    let seq = berlinGenSeq(scale, root, seqLen);
    let melody = berlinGenMelody(scale, root); // 32-step (2 bars)
    let bassLine = berlinGenBassLine(scale, root, 8); // 8 bars

    // Voice gates that fade in/out across the arrangement
    const leadGain = ctx.createGain(); leadGain.gain.value = 0;
    const bassVoiceGain = ctx.createGain(); bassVoiceGain.gain.value = 0;
    const seqVoiceGain = ctx.createGain(); seqVoiceGain.gain.value = 1;
    layer.gains.push(leadGain, bassVoiceGain, seqVoiceGain);

    // Spatial panners — each voice orbits the listener with its own movement
    const seqPanner = createHRTF(6, 1, 0);
    const leadPanner = createHRTF(-5, 2, -3);
    const bassPanner = createHRTF(0, -1, 5);
    createSpatialSource(seqPanner, 'orbit', 99999).radius = 7;
    createSpatialSource(leadPanner, 'wander', 99999);
    createSpatialSource(bassPanner, 'orbit', 99999).radius = 5;
    // Route voice gains through their panners → mainGain
    seqVoiceGain.connect(seqPanner._distFilter); seqPanner._distFilter.connect(seqPanner); seqPanner.connect(mainGain);
    leadGain.connect(leadPanner._distFilter); leadPanner._distFilter.connect(leadPanner); leadPanner.connect(mainGain);
    bassVoiceGain.connect(bassPanner._distFilter); bassPanner._distFilter.connect(bassPanner); bassPanner.connect(mainGain);

    // Slow-evolving pad chord
    const padFreqs = [scale[0], scale[2 % scale.length], scale[4 % scale.length], scale[6 % scale.length] || scale[1]]
        .map(s => r.baseFreq * Math.pow(2, s / 12));
    const padGain = ctx.createGain(); padGain.gain.value = 0; padGain.connect(mainGain);
    const padOscs = [];
    padFreqs.forEach(f => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 1.005;
        const g = ctx.createGain(); g.gain.value = 0.045 / padFreqs.length;
        o.connect(g); o2.connect(g); g.connect(padGain);
        o.start(); o2.start();
        padOscs.push(o, o2);
        layer.nodes.push(o, o2);
        layer.gains.push(g);
    });
    padGain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 6);
    layer.gains.push(padGain);

    // Per-step filter sweeps (slow sine LFO over 32 bars)
    const t0 = ctx.currentTime;
    const sweepPeriodSec = (stepTime * 16) * 16; // 16 bars
    let stepIdx = 0, barCount = 0;
    let nextStepTime = t0 + 0.05;
    let kickActive = false;

    const interval = setInterval(() => {
        if (!isPlaying) return;
        while (nextStepTime < ctx.currentTime + 0.15) {
            const s = stepIdx % 16;
            if (s === 0) {
                barCount++;
                if (barCount % 8 === 0 && Math.random() < 0.6) seq = berlinGenSeq(scale, root, seqLen);
                if (barCount % 4 === 0 && Math.random() < 0.5) melody = berlinGenMelody(scale, root);
                if (barCount % 8 === 0 && Math.random() < 0.5) bassLine = berlinGenBassLine(scale, root, 8);
                if (barCount === 8) kickActive = true;
                if (barCount > 24 && barCount % 16 === 0) kickActive = !kickActive;
                // Stagger voice fade-ins
                if (barCount === 4) {
                    bassVoiceGain.gain.cancelScheduledValues(nextStepTime);
                    bassVoiceGain.gain.linearRampToValueAtTime(0.9, nextStepTime + stepTime * 16);
                }
                if (barCount === 12) {
                    leadGain.gain.cancelScheduledValues(nextStepTime);
                    leadGain.gain.linearRampToValueAtTime(0.85, nextStepTime + stepTime * 16);
                }
                // Lead voice toggles every 8-16 bars after intro
                if (barCount > 16 && barCount % (8 + Math.floor(Math.random() * 8)) === 0) {
                    const cur = leadGain.gain.value;
                    const target = cur < 0.3 ? (0.7 + Math.random() * 0.3) : 0;
                    leadGain.gain.cancelScheduledValues(nextStepTime);
                    leadGain.gain.setValueAtTime(cur, nextStepTime);
                    leadGain.gain.linearRampToValueAtTime(target, nextStepTime + stepTime * 16);
                }
            }

            const seqIdx = stepIdx % seqLen;
            // Filter sweep value
            const phase = ((nextStepTime - t0) / sweepPeriodSec) * Math.PI * 2;
            const sweep = 600 + (Math.sin(phase) * 0.5 + 0.5) * 3200;
            berlinSeqNote(nextStepTime, seqVoiceGain, seq[seqIdx], stepTime, sweep);

            if (kickActive && s % 4 === 0) berlinKick(nextStepTime, mainGain);

            // Bass: one note per bar at s=0
            if (s === 0) {
                const bIdx = (barCount - 1) % bassLine.length;
                berlinSubBass(nextStepTime, bassVoiceGain, bassLine[bIdx], stepTime * 14);
            }

            // Lead melody: 32-step pattern (2 bars), positioned by overall step
            const mIdx = (stepIdx % 32);
            if (melody[mIdx]) {
                berlinLeadNote(nextStepTime, leadGain, melody[mIdx], stepTime * 4, 0.9);
            }

            stepIdx++;
            nextStepTime += stepTime;
        }
    }, 25);

    layer.intervals.push(interval);
    layer.gains.push(mainGain);
    return layer;
}

// ========== DUB SYSTEM ==========
// Slow reggae feel: kick on 1 & 3, snare on 3, offbeat skank chord with delay, deep bass.

function dubKick(when, out) {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(95, when);
    osc.frequency.exponentialRampToValueAtTime(38, when + 0.15);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.7, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.35);
    osc.connect(env); env.connect(out);
    osc.start(when); osc.stop(when + 0.4);
}
function dubSnare(when, out) {
    const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.25);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.32, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    n.connect(f); f.connect(env); env.connect(out);
    n.start(when); n.stop(when + 0.25);
}
function dubRim(when, out) {
    const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 800;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.12, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    osc.connect(env); env.connect(out);
    osc.start(when); osc.stop(when + 0.05);
}
function dubBassNote(when, out, freq, dur) {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = freq * 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 280; f.Q.value = 1;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.5, when + 0.02);
    env.gain.setValueAtTime(0.5, when + dur * 0.5);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(f); osc2.connect(g2); g2.connect(f); f.connect(env); env.connect(out);
    osc.start(when); osc2.start(when);
    osc.stop(when + dur + 0.05); osc2.stop(when + dur + 0.05);
}
function dubSkank(when, out, chordFreqs, dur) {
    chordFreqs.forEach(freq => {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
        const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = freq;
        const g2 = ctx.createGain(); g2.gain.value = 0.5;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.value = Math.min(freq * 4, 3500); f.Q.value = 4;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(0.28, when + 0.008);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        osc.connect(env); osc2.connect(g2); g2.connect(env);
        env.connect(f); f.connect(out);
        osc.start(when); osc2.start(when);
        osc.stop(when + dur + 0.05); osc2.stop(when + dur + 0.05);
    });
}

function createDubSystem(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain(); mainGain.gain.value = 0.85;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    // Skank dub-delay bus
    const skankBus = ctx.createGain(); skankBus.gain.value = 1.0; skankBus.connect(mainGain);
    const delay = ctx.createDelay(2.0); delay.delayTime.value = 60 / (r.bpm || 76) * 0.75; // dotted 8th
    const fb = ctx.createGain(); fb.gain.value = 0.45;
    const delayLP = ctx.createBiquadFilter(); delayLP.type = 'lowpass'; delayLP.frequency.value = 2400;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    skankBus.connect(delay); delay.connect(delayLP); delayLP.connect(fb); fb.connect(delay);
    delayLP.connect(wet); wet.connect(mainGain);
    layer.gains.push(skankBus, delay, fb, delayLP, wet);

    const bpm = r.bpm || 76;
    const stepTime = 60 / bpm / 4;
    const scale = r.toneScale || [0, 2, 4, 5, 7, 9, 11];
    const root = r.baseFreq;

    // Chord progression by scale-degree index (i, IV, V, i variant)
    const progs = [[0, 3, 4, 0], [0, 4, 3, 0], [0, 5, 3, 4], [0, 0, 3, 4]];
    let prog = progs[Math.floor(Math.random() * progs.length)];

    let stepIdx = 0, barCount = 0;
    let nextStepTime = ctx.currentTime + 0.05;

    const interval = setInterval(() => {
        if (!isPlaying) return;
        while (nextStepTime < ctx.currentTime + 0.15) {
            const s = stepIdx % 16;
            if (s === 0) {
                barCount++;
                if (barCount % 4 === 1) prog = progs[Math.floor(Math.random() * progs.length)];
            }

            // One Drop pattern: kick on beat 3 (step 8), snare on beat 3 too
            if (s === 8) { dubKick(nextStepTime, mainGain); dubSnare(nextStepTime, mainGain); }
            if (s === 0 && Math.random() < 0.4) dubKick(nextStepTime, mainGain);
            if (s === 14 && Math.random() < 0.3) dubRim(nextStepTime, mainGain);

            // Skank on the 'and' of each beat (steps 2, 6, 10, 14)
            if (s % 4 === 2) {
                const chordIdx = Math.floor(s / 4);
                const rootDeg = prog[chordIdx];
                const chord = [0, 2, 4].map(off => {
                    const semis = scale[(rootDeg + off) % scale.length] + 12 * Math.floor((rootDeg + off) / scale.length);
                    return root * 2 * Math.pow(2, semis / 12);
                });
                dubSkank(nextStepTime, skankBus, chord, stepTime * 0.5);
            }

            // Bass: root on beat 1 and 3, walking on 'and of 4'
            if (s === 0 || s === 8) {
                const rootDeg = prog[Math.floor(s / 4)];
                const bassFreq = root * Math.pow(2, scale[rootDeg % scale.length] / 12) * 0.5;
                dubBassNote(nextStepTime, mainGain, bassFreq, stepTime * 3.5);
            }
            if (s === 14 && Math.random() < 0.5) {
                const rootDeg = prog[3];
                const bassFreq = root * Math.pow(2, scale[(rootDeg + 4) % scale.length] / 12) * 0.5;
                dubBassNote(nextStepTime, mainGain, bassFreq, stepTime * 1.5);
            }

            stepIdx++;
            nextStepTime += stepTime;
        }
    }, 25);

    layer.intervals.push(interval);
    layer.gains.push(mainGain);
    return layer;
}

// ========== SONATA SYSTEMS ==========
// Melodic, on-beat reinterpretations of environment worlds. Each voice plays a
// scale-locked pattern with its own randomized rhythm, regenerated every few bars.

// Convert a scale-degree index (can be negative or > scale.length) to a frequency
// relative to root. Wraps degrees through octaves.
function sonataDegFreq(root, scale, deg) {
    const octave = Math.floor(deg / scale.length);
    const within = ((deg % scale.length) + scale.length) % scale.length;
    return root * Math.pow(2, (scale[within] + 12 * octave) / 12);
}

// Build a randomized step pattern for one voice
function sonataPattern(steps, density, scale, scaleRange, restProb) {
    const p = new Array(steps).fill(null);
    for (let i = 0; i < steps; i++) {
        if (Math.random() < density) {
            const deg = Math.floor(Math.random() * (scaleRange.hi - scaleRange.lo + 1)) + scaleRange.lo;
            p[i] = { deg, vel: 0.5 + Math.random() * 0.5 };
        }
    }
    if (Math.random() < restProb) p[0] = null;
    return p;
}

// ----- Voice synths -----

function sonataFlute(when, out, freq, dur, vel) {
    // Bird-like flute: sine fundamental + small chiff transient + breath noise
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    // Subtle vibrato after attack
    const vib = ctx.createOscillator(); vib.frequency.value = 5;
    const vibG = ctx.createGain(); vibG.gain.value = 0; vibG.gain.setValueAtTime(0, when);
    vibG.gain.linearRampToValueAtTime(freq * 0.008, when + dur * 0.4);
    vib.connect(vibG); vibG.connect(o1.frequency); vibG.connect(o2.frequency);
    // Breath
    const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.4);
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = freq * 1.2; nf.Q.value = 1.5;
    const nGain = ctx.createGain(); nGain.gain.setValueAtTime(0, when);
    nGain.gain.linearRampToValueAtTime(vel * 0.04, when + 0.025);
    nGain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    n.connect(nf); nf.connect(nGain); nGain.connect(out);
    // Tone envelope
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.22, when + 0.03);
    env.gain.setValueAtTime(vel * 0.22, when + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o1.connect(env); o2.connect(g2); g2.connect(env); env.connect(out);
    o1.start(when); o2.start(when); vib.start(when); n.start(when);
    const stopAt = when + dur + 0.05;
    o1.stop(stopAt); o2.stop(stopAt); vib.stop(stopAt); n.stop(stopAt);
}

function sonataFrogBass(when, out, freq, dur, vel) {
    // Plucky low sine + quick downward sweep
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.4, when);
    osc.frequency.exponentialRampToValueAtTime(freq, when + 0.06);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.4, when + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(env); env.connect(out);
    osc.start(when); osc.stop(when + dur + 0.05);
}

function sonataShaker(when, out, vel) {
    // Cicada-flavored shaker: short bandpassed noise burst
    const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.15);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = 4500 + Math.random() * 1000; f.Q.value = 1.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.08, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
    n.connect(f); f.connect(env); env.connect(out);
    n.start(when); n.stop(when + 0.09);
}

function sonataOwlPad(when, out, freqs, dur, params) {
    params = params || {};
    const detune = params.detune || 1.005;
    const gainMult = params.gainMult || 1.0;
    const peak = (0.20 / freqs.length) * gainMult;
    const harmonic = params.harmonic || 0;
    const harmonicGain = params.harmonicGain || 0.22;
    const wobbleHz = params.wobbleHz || 0;
    const wobbleDepth = params.wobbleDepth || 0;
    freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * detune;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(peak, when + dur * 0.25);
        env.gain.setValueAtTime(peak, when + dur * 0.7);
        env.gain.linearRampToValueAtTime(0, when + dur);
        osc.connect(env); osc2.connect(env);
        const stopAt = when + dur + 0.05;
        osc.start(when); osc2.start(when);
        osc.stop(stopAt); osc2.stop(stopAt);
        if (harmonic) {
            const oh = ctx.createOscillator(); oh.type = 'sine'; oh.frequency.value = freq * harmonic;
            const gh = ctx.createGain(); gh.gain.value = harmonicGain;
            oh.connect(gh); gh.connect(env);
            oh.start(when); oh.stop(stopAt);
        }
        if (wobbleHz) {
            const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = wobbleHz;
            const lfoG = ctx.createGain(); lfoG.gain.value = freq * wobbleDepth;
            lfo.connect(lfoG); lfoG.connect(osc.frequency); lfoG.connect(osc2.frequency);
            lfo.start(when); lfo.stop(stopAt);
        }
        env.connect(out);
    });
}

function sonataIceBell(when, out, freq, dur, vel) {
    // Inharmonic bell: fundamental + bright partial at 2.76x
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.76;
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = freq * 5.4;
    const g1 = ctx.createGain(); g1.gain.value = 1.0;
    const g2 = ctx.createGain(); g2.gain.value = 0.45;
    const g3 = ctx.createGain(); g3.gain.value = 0.12;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.26, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o1.connect(g1); g1.connect(env);
    o2.connect(g2); g2.connect(env);
    o3.connect(g3); g3.connect(env);
    env.connect(out);
    o1.start(when); o2.start(when); o3.start(when);
    const stopAt = when + dur + 0.05;
    o1.stop(stopAt); o2.stop(stopAt); o3.stop(stopAt);
}

function sonataGlacierSub(when, out, freq, dur, vel) {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = freq * 0.5;
    const subG = ctx.createGain(); subG.gain.value = 0.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.4, when + 0.04);
    env.gain.setValueAtTime(vel * 0.4, when + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(env); sub.connect(subG); subG.connect(env); env.connect(out);
    osc.start(when); sub.start(when);
    osc.stop(when + dur + 0.05); sub.stop(when + dur + 0.05);
}

function sonataWolfHowl(when, out, freq, dur, vel) {
    // Slow rising-falling sawtooth with bandpass — wolf-like wail
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.85, when);
    osc.frequency.linearRampToValueAtTime(freq, when + dur * 0.3);
    osc.frequency.linearRampToValueAtTime(freq * 0.92, when + dur * 0.85);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = freq * 2.5; f.Q.value = 4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.16, when + dur * 0.2);
    env.gain.setValueAtTime(vel * 0.16, when + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(f); f.connect(env); env.connect(out);
    osc.start(when); osc.stop(when + dur + 0.05);
}

function sonataThunderKick(when, out) {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(140, when);
    osc.frequency.exponentialRampToValueAtTime(35, when + 0.25);
    const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('brown', 0.6);
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 200;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0, when);
    nGain.gain.linearRampToValueAtTime(0.4, when + 0.01);
    nGain.gain.exponentialRampToValueAtTime(0.001, when + 0.5);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.7, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.5);
    osc.connect(env); n.connect(nf); nf.connect(nGain); nGain.connect(out); env.connect(out);
    osc.start(when); n.start(when);
    osc.stop(when + 0.55); n.stop(when + 0.55);
}

function sonataRainHat(when, out, vel) {
    const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.2);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; f.Q.value = 1;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.1, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
    n.connect(f); f.connect(env); env.connect(out);
    n.start(when); n.stop(when + 0.08);
}

function sonataWindMelody(when, out, freq, dur, vel) {
    // Breathy filtered noise tone — wind voice singing a note
    const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 1.5); n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = freq; f.Q.value = 22;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass';
    f2.frequency.value = freq * 2; f2.Q.value = 22;
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.5, when + dur * 0.2);
    env.gain.setValueAtTime(vel * 0.5, when + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    n.connect(f); f.connect(env);
    n.connect(f2); f2.connect(g2); g2.connect(env);
    env.connect(out);
    n.start(when); n.stop(when + dur + 0.05);
}

function sonataDeepHorn(when, out, freq, dur, vel) {
    // Thunder-like deep horn: detuned sawtooths through lowpass
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.005;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 4; f.Q.value = 1.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.22, when + 0.05);
    env.gain.setValueAtTime(vel * 0.22, when + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o1.connect(env); o2.connect(env); env.connect(f); f.connect(out);
    o1.start(when); o2.start(when);
    const stopAt = when + dur + 0.05;
    o1.stop(stopAt); o2.stop(stopAt);
}

// ----- Forest Sonata -----

function createForestSonataSystem(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain(); mainGain.gain.value = 0.85;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const bpm = r.bpm || 96;
    const stepTime = 60 / bpm / 4;
    const scale = r.toneScale || [0, 3, 5, 7, 10, 12];
    const root = r.baseFreq;

    // Spatial panners — each voice has its own location and motion
    const flutePanner = createHRTF(-4, 2, 2);
    const bassPanner = createHRTF(0, -1, -3);
    const shakerPanner = createHRTF(5, 1, -1);
    createSpatialSource(flutePanner, 'wander', 99999);
    createSpatialSource(bassPanner, 'hover', 99999);
    createSpatialSource(shakerPanner, 'orbit', 99999).radius = 6;

    const fluteGain = ctx.createGain(); fluteGain.gain.value = 0.9;
    const bassGain = ctx.createGain(); bassGain.gain.value = 0.85;
    const shakerGain = ctx.createGain(); shakerGain.gain.value = 0.85;
    const padGain = ctx.createGain(); padGain.gain.value = 0.75;
    fluteGain.connect(flutePanner._distFilter); flutePanner._distFilter.connect(flutePanner); flutePanner.connect(mainGain);
    bassGain.connect(bassPanner._distFilter); bassPanner._distFilter.connect(bassPanner); bassPanner.connect(mainGain);
    shakerGain.connect(shakerPanner._distFilter); shakerPanner._distFilter.connect(shakerPanner); shakerPanner.connect(mainGain);
    padGain.connect(mainGain);
    layer.gains.push(fluteGain, bassGain, shakerGain, padGain);

    let fluteP = sonataPattern(16, 0.45, scale, { lo: 7, hi: 14 }, 0.2);
    let bassP = sonataPattern(16, 0.3, scale, { lo: -7, hi: 0 }, 0.0);
    let shakerP = sonataPattern(16, 0.5, scale, { lo: 0, hi: 0 }, 0.0);
    bassP[0] = { deg: 0, vel: 0.85 };
    let chordRoots = [0, 3, 4, 0];

    let stepIdx = 0, barCount = 0;
    let nextStepTime = ctx.currentTime + 0.05;

    const interval = setInterval(() => {
        if (!isPlaying) return;
        while (nextStepTime < ctx.currentTime + 0.15) {
            const s = stepIdx % 16;
            if (s === 0) {
                barCount++;
                if (barCount % 4 === 1) {
                    fluteP = sonataPattern(16, 0.45, scale, { lo: 7, hi: 14 }, 0.2);
                    chordRoots = [0, 3, 4, 0].sort(() => Math.random() - 0.5);
                    chordRoots[0] = 0;
                }
                if (barCount % 8 === 1) bassP = sonataPattern(16, 0.3, scale, { lo: -7, hi: 0 }, 0.0);
                if (barCount % 4 === 1) bassP[0] = { deg: 0, vel: 0.85 };
                if (barCount % 2 === 1) shakerP = sonataPattern(16, 0.55, scale, { lo: 0, hi: 0 }, 0.0);

                // Owl-pad chord every 4 steps (one per bar)
                const chordRoot = chordRoots[(barCount - 1) % 4];
                const chord = [chordRoot, chordRoot + 2, chordRoot + 4].map(d => sonataDegFreq(root, scale, d));
                sonataOwlPad(nextStepTime, padGain, chord, stepTime * 16);
            }

            if (fluteP[s]) sonataFlute(nextStepTime, fluteGain, sonataDegFreq(root, scale, fluteP[s].deg), stepTime * 2.5, fluteP[s].vel);
            if (bassP[s]) sonataFrogBass(nextStepTime, bassGain, sonataDegFreq(root, scale, bassP[s].deg) * 0.5, stepTime * 2, bassP[s].vel);
            if (shakerP[s]) sonataShaker(nextStepTime, shakerGain, shakerP[s].vel);

            stepIdx++;
            nextStepTime += stepTime;
        }
    }, 25);

    layer.intervals.push(interval);
    layer.gains.push(mainGain);
    return layer;
}

// ----- Tundra Sonata -----

function createTundraSonataSystem(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain(); mainGain.gain.value = 0.85;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const bpm = r.bpm || 88;
    const stepTime = 60 / bpm / 4;
    const scale = r.toneScale || [0, 2, 5, 7, 9, 12];
    const root = r.baseFreq;

    const bellPanner = createHRTF(3, 2, 1);
    const wolfPanner = createHRTF(-6, 0, -4);
    const subPanner = createHRTF(0, -2, 4);
    createSpatialSource(bellPanner, 'orbit', 99999).radius = 4;
    createSpatialSource(wolfPanner, 'wander', 99999);
    createSpatialSource(subPanner, 'hover', 99999);

    const bellGain = ctx.createGain(); bellGain.gain.value = 0.9;
    const wolfGain = ctx.createGain(); wolfGain.gain.value = 0;
    const subGain = ctx.createGain(); subGain.gain.value = 0.85;
    const hatGain = ctx.createGain(); hatGain.gain.value = 0.7;
    bellGain.connect(bellPanner._distFilter); bellPanner._distFilter.connect(bellPanner); bellPanner.connect(mainGain);
    wolfGain.connect(wolfPanner._distFilter); wolfPanner._distFilter.connect(wolfPanner); wolfPanner.connect(mainGain);
    subGain.connect(subPanner._distFilter); subPanner._distFilter.connect(subPanner); subPanner.connect(mainGain);
    hatGain.connect(mainGain);
    layer.gains.push(bellGain, wolfGain, subGain, hatGain);

    let bellP = sonataPattern(16, 0.55, scale, { lo: 7, hi: 17 }, 0.1);
    let subP = sonataPattern(16, 0.25, scale, { lo: -7, hi: 0 }, 0.0);
    subP[0] = { deg: 0, vel: 0.9 };
    let wolfP = sonataPattern(8, 0.35, scale, { lo: 4, hi: 11 }, 0.4);
    let hatP = sonataPattern(16, 0.45, scale, { lo: 0, hi: 0 }, 0.0);

    let stepIdx = 0, barCount = 0;
    let nextStepTime = ctx.currentTime + 0.05;

    const interval = setInterval(() => {
        if (!isPlaying) return;
        while (nextStepTime < ctx.currentTime + 0.15) {
            const s = stepIdx % 16;
            if (s === 0) {
                barCount++;
                if (barCount % 4 === 1) bellP = sonataPattern(16, 0.55, scale, { lo: 7, hi: 17 }, 0.1);
                if (barCount % 8 === 1) {
                    subP = sonataPattern(16, 0.25, scale, { lo: -7, hi: 0 }, 0.0);
                    subP[0] = { deg: 0, vel: 0.9 };
                }
                if (barCount % 2 === 1) hatP = sonataPattern(16, 0.45, scale, { lo: 0, hi: 0 }, 0.0);
                if (barCount === 6) {
                    wolfGain.gain.cancelScheduledValues(nextStepTime);
                    wolfGain.gain.linearRampToValueAtTime(0.85, nextStepTime + stepTime * 16);
                }
                if (barCount > 12 && barCount % 8 === 0) {
                    wolfP = sonataPattern(8, 0.4, scale, { lo: 4, hi: 11 }, 0.4);
                }
            }

            if (bellP[s]) sonataIceBell(nextStepTime, bellGain, sonataDegFreq(root, scale, bellP[s].deg), stepTime * 6, bellP[s].vel);
            if (subP[s]) sonataGlacierSub(nextStepTime, subGain, sonataDegFreq(root, scale, subP[s].deg) * 0.5, stepTime * 8, subP[s].vel);
            if (hatP[s] && s % 2 === 0) sonataRainHat(nextStepTime, hatGain, hatP[s].vel * 0.7);

            // Wolf at half the rate (every other step in 8-step pattern)
            if (s % 2 === 0) {
                const wolfIdx = (stepIdx / 2) % 8;
                if (wolfP[Math.floor(wolfIdx)]) {
                    const note = wolfP[Math.floor(wolfIdx)];
                    sonataWolfHowl(nextStepTime, wolfGain, sonataDegFreq(root, scale, note.deg), stepTime * 6, note.vel);
                }
            }

            stepIdx++;
            nextStepTime += stepTime;
        }
    }, 25);

    layer.intervals.push(interval);
    layer.gains.push(mainGain);
    return layer;
}

// ----- Storm Sonata -----

function createStormSonataSystem(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain(); mainGain.gain.value = 0.85;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const bpm = r.bpm || 84;
    const stepTime = 60 / bpm / 4;
    const scale = r.toneScale || [0, 1, 5, 6, 10, 11];
    const root = r.baseFreq;

    const windPanner = createHRTF(-5, 3, 2);
    const hornPanner = createHRTF(4, -1, -3);
    createSpatialSource(windPanner, 'wander', 99999);
    createSpatialSource(hornPanner, 'orbit', 99999).radius = 5;

    const windGain = ctx.createGain(); windGain.gain.value = 0.85;
    const hornGain = ctx.createGain(); hornGain.gain.value = 0.85;
    const hatGain = ctx.createGain(); hatGain.gain.value = 0.6;
    windGain.connect(windPanner._distFilter); windPanner._distFilter.connect(windPanner); windPanner.connect(mainGain);
    hornGain.connect(hornPanner._distFilter); hornPanner._distFilter.connect(hornPanner); hornPanner.connect(mainGain);
    hatGain.connect(mainGain);
    layer.gains.push(windGain, hornGain, hatGain);

    let windP = sonataPattern(8, 0.45, scale, { lo: 7, hi: 14 }, 0.2);
    let hornP = sonataPattern(8, 0.4, scale, { lo: -7, hi: 0 }, 0.1);
    hornP[0] = { deg: 0, vel: 0.85 };

    let stepIdx = 0, barCount = 0;
    let nextStepTime = ctx.currentTime + 0.05;

    const interval = setInterval(() => {
        if (!isPlaying) return;
        while (nextStepTime < ctx.currentTime + 0.15) {
            const s = stepIdx % 16;
            if (s === 0) {
                barCount++;
                if (barCount % 4 === 1) windP = sonataPattern(8, 0.45, scale, { lo: 7, hi: 14 }, 0.2);
                if (barCount % 4 === 1) {
                    hornP = sonataPattern(8, 0.4, scale, { lo: -7, hi: 0 }, 0.1);
                    hornP[0] = { deg: 0, vel: 0.85 };
                }
            }

            // Thunder kick on beats 1 and 3
            if (s === 0 || s === 8) sonataThunderKick(nextStepTime, mainGain);
            // Rainy hats on every 16th
            if (s % 2 === 0) sonataRainHat(nextStepTime, hatGain, 0.5 + (s % 4 === 0 ? 0.5 : 0));
            // Wind voice melody and deep horn at half speed (each step in 8-pattern = 2 sixteenths)
            if (s % 2 === 0) {
                const halfIdx = (stepIdx / 2) % 8;
                if (windP[Math.floor(halfIdx)]) {
                    const note = windP[Math.floor(halfIdx)];
                    sonataWindMelody(nextStepTime, windGain, sonataDegFreq(root, scale, note.deg), stepTime * 4, note.vel);
                }
                if (hornP[Math.floor(halfIdx)]) {
                    const note = hornP[Math.floor(halfIdx)];
                    sonataDeepHorn(nextStepTime, hornGain, sonataDegFreq(root, scale, note.deg) * 0.5, stepTime * 4, note.vel);
                }
            }

            stepIdx++;
            nextStepTime += stepTime;
        }
    }, 25);

    layer.intervals.push(interval);
    layer.gains.push(mainGain);
    return layer;
}

// ----- Astral Sonata -----
// Slow, ethereal: deep celestial lead + bright aurora counter, twinkling star
// bells, pulsar sub anchor, warm terrestrial pad. Big radii, slow motion.

function astralCelestialNote(when, out, freq, dur, vel) {
    // Like mirage but deeper — sine + sub-octave + slow vibrato, long swell
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = freq * 0.5;
    const subG = ctx.createGain(); subG.gain.value = 0.4;
    const vib = ctx.createOscillator(); vib.frequency.value = 4;
    const vibG = ctx.createGain(); vibG.gain.value = freq * 0.008;
    vib.connect(vibG); vibG.connect(o.frequency); vibG.connect(sub.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.22, when + dur * 0.4);
    env.gain.setValueAtTime(vel * 0.22, when + dur * 0.75);
    env.gain.linearRampToValueAtTime(0, when + dur);
    o.connect(env); sub.connect(subG); subG.connect(env); env.connect(out);
    o.start(when); sub.start(when); vib.start(when);
    const stopAt = when + dur + 0.05;
    o.stop(stopAt); sub.stop(stopAt); vib.stop(stopAt);
}

function astralAuroraNote(when, out, freq, dur, vel) {
    // High shimmer: sine + sine 2x with slow 6Hz vibrato, gentle long swell
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    const vib = ctx.createOscillator(); vib.frequency.value = 6;
    const vibG = ctx.createGain(); vibG.gain.value = freq * 0.012;
    vib.connect(vibG); vibG.connect(o.frequency); vibG.connect(o2.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.16, when + dur * 0.4);
    env.gain.setValueAtTime(vel * 0.16, when + dur * 0.7);
    env.gain.linearRampToValueAtTime(0, when + dur);
    o.connect(env); o2.connect(g2); g2.connect(env); env.connect(out);
    o.start(when); o2.start(when); vib.start(when);
    const stopAt = when + dur + 0.05;
    o.stop(stopAt); o2.stop(stopAt); vib.stop(stopAt);
}

function astralStarBell(when, out, freq, dur, vel) {
    // Glockenspiel-flavored star
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 4;
    const g2 = ctx.createGain(); g2.gain.value = 0.32;
    const env = ctx.createGain();
    const dec = Math.min(dur, 1.4);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.26, when + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dec);
    o1.connect(env); o2.connect(g2); g2.connect(env); env.connect(out);
    o1.start(when); o2.start(when);
    const stopAt = when + dec + 0.05;
    o1.stop(stopAt); o2.stop(stopAt);
}

function astralPulsarSub(when, out, freq, dur, vel) {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = freq * 0.5;
    const subG = ctx.createGain(); subG.gain.value = 0.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel * 0.42, when + 0.04);
    env.gain.setValueAtTime(vel * 0.42, when + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(env); sub.connect(subG); subG.connect(env); env.connect(out);
    osc.start(when); sub.start(when);
    osc.stop(when + dur + 0.05); sub.stop(when + dur + 0.05);
}

// Black hole: tumbles through a sequence of scale-locked sub frequencies,
// crossfading between them — like a falling spiral of bass notes.
function astralBlackHole(when, out, freqs, totalDur, vel) {
    const slice = totalDur / freqs.length;
    freqs.forEach((freq, i) => {
        const t = when + i * slice;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
        const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = freq * 0.5;
        const subG = ctx.createGain(); subG.gain.value = 0.5;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel * 0.32, t + slice * 0.35);
        env.gain.setValueAtTime(vel * 0.32, t + slice * 0.65);
        env.gain.linearRampToValueAtTime(0, t + slice);
        o.connect(env); sub.connect(subG); subG.connect(env); env.connect(out);
        o.start(t); sub.start(t);
        const stopAt = t + slice + 0.05;
        o.stop(stopAt); sub.stop(stopAt);
    });
}

// Gas giant: chord pad with slow tremolo and a long filter sweep that
// breathes over the full duration — chord tones are scale-locked.
function astralGasGiant(when, out, freqs, totalDur) {
    freqs.forEach(freq => {
        const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq;
        const car2 = ctx.createOscillator(); car2.type = 'triangle'; car2.frequency.value = freq * 1.005;
        const c2g = ctx.createGain(); c2g.gain.value = 0.35;
        // Slow tremolo (sub-audio) — actual pad breath, not an audio-rate AM
        const trem = ctx.createOscillator(); trem.type = 'sine';
        trem.frequency.value = 0.5 + Math.random() * 1.2;
        const tremG = ctx.createGain(); tremG.gain.value = 0.18;
        const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = freq * 0.5;
        const subG = ctx.createGain(); subG.gain.value = 0.3;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.5;
        f.frequency.setValueAtTime(freq * 1.5, when);
        f.frequency.linearRampToValueAtTime(freq * 4.5, when + totalDur * 0.5);
        f.frequency.linearRampToValueAtTime(freq * 1.5, when + totalDur);
        // Tremolo on a separate gain in series so it doesn't fight the env automation
        const tremGain = ctx.createGain(); tremGain.gain.value = 1;
        trem.connect(tremG); tremG.connect(tremGain.gain);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(0.18 / freqs.length, when + totalDur * 0.25);
        env.gain.setValueAtTime(0.18 / freqs.length, when + totalDur * 0.75);
        env.gain.linearRampToValueAtTime(0, when + totalDur);
        car.connect(env); car2.connect(c2g); c2g.connect(env);
        sub.connect(subG); subG.connect(env);
        env.connect(f); f.connect(tremGain); tremGain.connect(out);
        car.start(when); car2.start(when); sub.start(when); trem.start(when);
        const stopAt = when + totalDur + 0.05;
        car.stop(stopAt); car2.stop(stopAt); sub.stop(stopAt); trem.stop(stopAt);
    });
}

// Main-sequence flare: a fast ascending scale arpeggio of bell-like notes —
// snappy, glittery burst of melodic light.
function astralFlare(when, out, freqs, totalDur, vel) {
    const stagger = Math.min(0.08, totalDur / (freqs.length + 1));
    const noteDur = 0.5;
    freqs.forEach((freq, i) => {
        const t = when + i * stagger;
        const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 4;
        const g2 = ctx.createGain(); g2.gain.value = 0.4;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel * 0.42, t + 0.004);
        env.gain.exponentialRampToValueAtTime(0.001, t + noteDur);
        o1.connect(env); o2.connect(g2); g2.connect(env); env.connect(out);
        o1.start(t); o2.start(t);
        const stopAt = t + noteDur + 0.05;
        o1.stop(stopAt); o2.stop(stopAt);
    });
}

// Glitter: a tiny, fast arpeggio of high bells — perceptibly "twinkly".
// Designed for snappier triggering than flares.
function astralGlitter(when, out, freqs, vel) {
    const stagger = 0.04 + Math.random() * 0.03;
    const noteDur = 0.3;
    freqs.forEach((freq, i) => {
        const t = when + i * stagger;
        const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 4.1;
        const g2 = ctx.createGain(); g2.gain.value = 0.3;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel * 0.36, t + 0.003);
        env.gain.exponentialRampToValueAtTime(0.001, t + noteDur);
        o1.connect(env); o2.connect(g2); g2.connect(env); env.connect(out);
        o1.start(t); o2.start(t);
        const stopAt = t + noteDur + 0.05;
        o1.stop(stopAt); o2.stop(stopAt);
    });
}

function createAstralSonataSystem(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain(); mainGain.gain.value = 0.85;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const bpm = r.bpm || 76;
    const stepTime = 60 / bpm / 4;
    const scale = r.toneScale || [0, 2, 4, 7, 9, 12];
    const root = r.baseFreq;

    // Spatial panners — big slow orbits / wanders for an open cosmic feel
    const celestialPanner = createHRTF(-7, 1, 4);
    const auroraPanner = createHRTF(6, 3, -2);
    const bellPanner = createHRTF(0, 4, 7);
    const subPanner = createHRTF(0, -3, -6);
    const blackHolePanner = createHRTF(2, -4, -8);
    const gasGiantPanner = createHRTF(-9, 0, -3);
    const flarePanner = createHRTF(8, 5, 5);
    createSpatialSource(celestialPanner, 'wander', 99999);
    createSpatialSource(auroraPanner, 'orbit', 99999).radius = 8;
    createSpatialSource(bellPanner, 'wander', 99999);
    createSpatialSource(subPanner, 'hover', 99999);
    createSpatialSource(blackHolePanner, 'orbit', 99999).radius = 9;
    createSpatialSource(gasGiantPanner, 'hover', 99999);
    createSpatialSource(flarePanner, 'wander', 99999);

    const celestialGain = ctx.createGain(); celestialGain.gain.value = 0.95;
    const auroraGain = ctx.createGain(); auroraGain.gain.value = 0;
    const bellGain = ctx.createGain(); bellGain.gain.value = 0.85;
    const subGain = ctx.createGain(); subGain.gain.value = 0.9;
    const padGain = ctx.createGain(); padGain.gain.value = 1.0;
    const blackHoleGain = ctx.createGain(); blackHoleGain.gain.value = 1.2;
    const gasGiantGain = ctx.createGain(); gasGiantGain.gain.value = 1.0;
    const flareGain = ctx.createGain(); flareGain.gain.value = 1.1;
    celestialGain.connect(celestialPanner._distFilter); celestialPanner._distFilter.connect(celestialPanner); celestialPanner.connect(mainGain);
    auroraGain.connect(auroraPanner._distFilter); auroraPanner._distFilter.connect(auroraPanner); auroraPanner.connect(mainGain);
    bellGain.connect(bellPanner._distFilter); bellPanner._distFilter.connect(bellPanner); bellPanner.connect(mainGain);
    subGain.connect(subPanner._distFilter); subPanner._distFilter.connect(subPanner); subPanner.connect(mainGain);
    blackHoleGain.connect(blackHolePanner._distFilter); blackHolePanner._distFilter.connect(blackHolePanner); blackHolePanner.connect(mainGain);
    gasGiantGain.connect(gasGiantPanner._distFilter); gasGiantPanner._distFilter.connect(gasGiantPanner); gasGiantPanner.connect(mainGain);
    flareGain.connect(flarePanner._distFilter); flarePanner._distFilter.connect(flarePanner); flarePanner.connect(mainGain);
    padGain.connect(mainGain);
    layer.gains.push(celestialGain, auroraGain, bellGain, subGain, padGain,
                     blackHoleGain, gasGiantGain, flareGain);

    // Patterns — long, sparse
    let celestialP = sonataPattern(16, 0.32, scale, { lo: 0, hi: 7 }, 0.15);
    let auroraP = sonataPattern(16, 0.3, scale, { lo: 7, hi: 14 }, 0.2);
    let bellP = sonataPattern(32, 0.4, scale, { lo: 7, hi: 18 }, 0.1);
    let subP = sonataPattern(16, 0.22, scale, { lo: -7, hi: 0 }, 0.0);
    subP[0] = { deg: 0, vel: 0.9 };
    let chordRoots = [0, 5, 3, 4];

    let stepIdx = 0, barCount = 0;
    let nextStepTime = ctx.currentTime + 0.05;

    const interval = setInterval(() => {
        if (!isPlaying) return;
        while (nextStepTime < ctx.currentTime + 0.15) {
            const s = stepIdx % 16;
            if (s === 0) {
                barCount++;
                if (barCount % 8 === 1) {
                    celestialP = sonataPattern(16, 0.32, scale, { lo: 0, hi: 7 }, 0.15);
                    chordRoots = [0, 5, 3, 4].sort(() => Math.random() - 0.5);
                    chordRoots[0] = 0;
                }
                if (barCount % 4 === 1) bellP = sonataPattern(32, 0.4, scale, { lo: 7, hi: 18 }, 0.1);
                if (barCount % 16 === 1) {
                    subP = sonataPattern(16, 0.22, scale, { lo: -7, hi: 0 }, 0.0);
                    subP[0] = { deg: 0, vel: 0.9 };
                }
                // Aurora fades in at bar 8, then toggles every 8-16 bars
                if (barCount === 8) {
                    auroraGain.gain.cancelScheduledValues(nextStepTime);
                    auroraGain.gain.linearRampToValueAtTime(0.85, nextStepTime + stepTime * 32);
                }
                if (barCount > 16 && barCount % (8 + Math.floor(Math.random() * 8)) === 0) {
                    const cur = auroraGain.gain.value;
                    const target = cur < 0.3 ? (0.7 + Math.random() * 0.3) : 0;
                    auroraGain.gain.cancelScheduledValues(nextStepTime);
                    auroraGain.gain.setValueAtTime(cur, nextStepTime);
                    auroraGain.gain.linearRampToValueAtTime(target, nextStepTime + stepTime * 24);
                }
                if (barCount > 12 && barCount % 12 === 0) auroraP = sonataPattern(16, 0.3, scale, { lo: 7, hi: 14 }, 0.2);

                // Pad chord on each bar
                const cr = chordRoots[(barCount - 1) % 4];
                const chord = [cr, cr + 2, cr + 4, cr + 6].map(d => sonataDegFreq(root, scale, d));
                if (totalVoices && totalVoices.pad_warm) {
                    totalVoices.pad_warm(nextStepTime, padGain, chord, stepTime * 16);
                }

                // Black hole — every 8 bars, tumble through 4 descending scale-locked sub freqs
                if (barCount % 8 === 1) {
                    const startDeg = Math.floor(Math.random() * 3); // 0, 1, or 2
                    const tumbleDegs = [];
                    for (let i = 0; i < 4; i++) tumbleDegs.push(startDeg - i * 2);
                    const tumbleFreqs = tumbleDegs.map(d => sonataDegFreq(root, scale, d) * 0.5);
                    astralBlackHole(nextStepTime, blackHoleGain, tumbleFreqs, stepTime * 16 * 8, 0.85);
                }

                // Gas giant — every 8 bars, hold a wide chord with a slow filter sweep
                if (barCount % 8 === 1) {
                    const ggCr = chordRoots[0];
                    const ggChord = [ggCr, ggCr + 4, ggCr + 7, ggCr + 9]
                        .map(d => sonataDegFreq(root, scale, d));
                    astralGasGiant(nextStepTime, gasGiantGain, ggChord, stepTime * 16 * 8);
                }

                // Main-sequence flare — every 2-3 bars, ascending bell arpeggio
                if (barCount >= 3 && barCount % (2 + Math.floor(Math.random() * 2)) === 0) {
                    const startDeg = 7 + Math.floor(Math.random() * 4);
                    const flareCount = 4 + Math.floor(Math.random() * 3);
                    const flareFreqs = [];
                    for (let i = 0; i < flareCount; i++) {
                        flareFreqs.push(sonataDegFreq(root, scale, startDeg + i * 2));
                    }
                    astralFlare(nextStepTime, flareGain, flareFreqs, stepTime * 4, 0.95);
                }

                // Glitter — every bar, ~70% chance, tiny fast bell run
                if (barCount >= 2 && Math.random() < 0.7) {
                    const startDeg = 9 + Math.floor(Math.random() * 5);
                    const ascending = Math.random() < 0.6;
                    const count = 4 + Math.floor(Math.random() * 4);
                    const glitterFreqs = [];
                    for (let i = 0; i < count; i++) {
                        const d = ascending ? startDeg + i : startDeg - i;
                        glitterFreqs.push(sonataDegFreq(root, scale, d));
                    }
                    astralGlitter(nextStepTime + Math.random() * stepTime * 4, flareGain, glitterFreqs, 0.85);
                }
            }

            // Celestial — half-rate (every other step) for slow lead
            if (s % 2 === 0) {
                const cIdx = (stepIdx / 2) % 16;
                if (celestialP[Math.floor(cIdx)]) {
                    const note = celestialP[Math.floor(cIdx)];
                    astralCelestialNote(nextStepTime, celestialGain, sonataDegFreq(root, scale, note.deg), stepTime * 8, note.vel);
                }
            }

            // Aurora — half-rate, in higher register
            if (s % 2 === 1) {
                const aIdx = (Math.floor(stepIdx / 2)) % 16;
                if (auroraP[aIdx]) {
                    const note = auroraP[aIdx];
                    astralAuroraNote(nextStepTime, auroraGain, sonataDegFreq(root, scale, note.deg), stepTime * 6, note.vel);
                }
            }

            // Star bells — full-rate twinkling 32-step pattern wrapped over 2 bars
            const bellIdx = stepIdx % 32;
            if (bellP[bellIdx]) {
                const note = bellP[bellIdx];
                astralStarBell(nextStepTime, bellGain, sonataDegFreq(root, scale, note.deg) * 2, stepTime * 3, note.vel);
            }

            // Sub pulsar — quarter-rate, low octave
            if (s % 4 === 0) {
                const subIdx = (stepIdx / 4) % 16;
                if (subP[Math.floor(subIdx)]) {
                    const note = subP[Math.floor(subIdx)];
                    astralPulsarSub(nextStepTime, subGain, sonataDegFreq(root, scale, note.deg) * 0.5, stepTime * 8, note.vel);
                }
            }

            stepIdx++;
            nextStepTime += stepTime;
        }
    }, 25);

    layer.intervals.push(interval);
    layer.gains.push(mainGain);
    return layer;
}

// ========== TOTAL SONATA SYSTEM ==========
// A massive entity-driven music engine. Many small "entities" each follow the
// global key/scale and the global tempo, but each has its own pattern length
// and step subdivision (creating natural polymeter). Entities fade in, perform,
// and fade out. The system maintains a target population (default ~5).

// ----- Voice synth library -----

// Vowel formant table (F1, F2 in Hz). Cycled per call by the talker voice.
const TALKER_VOWELS = [
    { f1: 700, f2: 1220 }, // 'ah'
    { f1: 530, f2: 1840 }, // 'eh'
    { f1: 270, f2: 2290 }, // 'ee'
    { f1: 570, f2: 840  }, // 'oh'
    { f1: 440, f2: 1020 }, // 'oo'
];
let _talkerVowelIdx = 0;

const totalVoices = {
    flute:   (when, out, freq, dur, vel) => sonataFlute(when, out, freq, dur, vel),
    bell:    (when, out, freq, dur, vel) => sonataIceBell(when, out, freq, dur, vel),
    horn:    (when, out, freq, dur, vel) => sonataDeepHorn(when, out, freq, dur, vel),
    sub:     (when, out, freq, dur, vel) => sonataGlacierSub(when, out, freq, dur, vel),
    pad_warm:(when, out, freqs, dur, params) => sonataOwlPad(when, out, freqs, dur, params),
    kick:    (when, out, vel)            => sonataThunderKick(when, out),
    click:   (when, out, vel)            => sonataShaker(when, out, vel),
    hat:     (when, out, vel)            => sonataRainHat(when, out, vel),

    // Talker: baritone vocal — sawtooth carrier through two formant bandpasses,
    // gentle vibrato, and a different vowel each successive note.
    talker: (when, out, freq, dur, vel) => {
        const v = TALKER_VOWELS[_talkerVowelIdx++ % TALKER_VOWELS.length];
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
        // Vibrato
        const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.2;
        const vibG = ctx.createGain(); vibG.gain.value = freq * 0.014;
        vib.connect(vibG); vibG.connect(o.frequency);
        // Two formants
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass';
        f1.frequency.value = v.f1; f1.Q.value = 9;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass';
        f2.frequency.value = v.f2; f2.Q.value = 11;
        const f1g = ctx.createGain(); f1g.gain.value = 1.4;
        const f2g = ctx.createGain(); f2g.gain.value = 0.85;
        // Gentle highpass to clear mud
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
        hp.frequency.value = Math.min(freq * 0.9, 120); hp.Q.value = 0.5;
        // Envelope — slow attack, long sustain, soft release
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.55, when + Math.min(0.18, dur * 0.18));
        env.gain.setValueAtTime(vel * 0.5, when + dur * 0.75);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(f1); o.connect(f2);
        f1.connect(f1g); f2.connect(f2g);
        f1g.connect(env); f2g.connect(env);
        env.connect(hp); hp.connect(out);
        const stopAt = when + dur + 0.1;
        o.start(when); vib.start(when);
        o.stop(stopAt); vib.stop(stopAt);
    },

    wail: (when, out, freq, dur, vel) => {
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
        o1.frequency.setValueAtTime(freq * 0.985, when);
        o1.frequency.linearRampToValueAtTime(freq, when + dur * 0.35);
        o1.frequency.linearRampToValueAtTime(freq * 1.005, when + dur * 0.85);
        const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.005;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.value = freq * 2.4; f.Q.value = 4;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.26, when + dur * 0.25);
        env.gain.setValueAtTime(vel * 0.16, when + dur * 0.7);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o1.connect(f); o2.connect(f); f.connect(env); env.connect(out);
        o1.start(when); o2.start(when);
        const stopAt = when + dur + 0.05;
        o1.stop(stopAt); o2.stop(stopAt);
    },

    breathy: (when, out, freq, dur, vel, params) => {
        params = params || {};
        const color = params.color || 'pink';
        const centerMult = params.centerMult || 1;
        const harmonic2 = params.harmonic2 || 2;
        const Q = params.Q || 6;                  // was 28 — way too narrow, things vanished
        const gainMult = params.gainMult || 1.0;
        const peak = vel * 0.85 * gainMult;       // boosted from 0.6 (Q drop also brings more energy through)
        const sweepMult = params.sweepMult || 0;  // optional pitch sweep (siren)
        const tremHz = params.tremHz || 0;
        const tremDepth = params.tremDepth || 0;
        const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer(color, 1.8); n.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass';
        const cf = freq * centerMult;
        f.frequency.value = cf; f.Q.value = Q;
        if (sweepMult) {
            f.frequency.setValueAtTime(cf, when);
            f.frequency.linearRampToValueAtTime(cf * sweepMult, when + dur * 0.5);
            f.frequency.linearRampToValueAtTime(cf, when + dur);
        }
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass';
        f2.frequency.value = cf * harmonic2; f2.Q.value = Q;
        const g2 = ctx.createGain(); g2.gain.value = 0.5;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(peak, when + dur * 0.2);
        env.gain.setValueAtTime(peak, when + dur * 0.7);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        n.connect(f); f.connect(env);
        n.connect(f2); f2.connect(g2); g2.connect(env);
        const stopAt = when + dur + 0.05;
        n.start(when); n.stop(stopAt);
        if (tremHz) {
            const trem = ctx.createGain(); trem.gain.value = 1.0;
            const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = tremHz;
            const lfoG = ctx.createGain(); lfoG.gain.value = tremDepth;
            lfo.connect(lfoG); lfoG.connect(trem.gain);
            env.connect(trem); trem.connect(out);
            lfo.start(when); lfo.stop(stopAt);
        } else {
            env.connect(out);
        }
    },

    pluck: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
        const g2 = ctx.createGain(); g2.gain.value = 0.18;
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass';
        fl.frequency.setValueAtTime(Math.min(freq * 6, 5000), when);
        fl.frequency.exponentialRampToValueAtTime(Math.min(freq * 2, 1500), when + dur * 0.7);
        fl.Q.value = 1;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.32, when + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(env); o2.connect(g2); g2.connect(env);
        env.connect(fl); fl.connect(out);
        o.start(when); o2.start(when);
        o.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
    },

    music_box: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 4.1;
        const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = freq * 6.7;
        const g2 = ctx.createGain(); g2.gain.value = 0.14;
        const g3 = ctx.createGain(); g3.gain.value = 0.06;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.36, when + 0.003);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(env); o2.connect(g2); g2.connect(env); o3.connect(g3); g3.connect(env);
        env.connect(out);
        o.start(when); o2.start(when); o3.start(when);
        const stopAt = when + dur + 0.05;
        o.stop(stopAt); o2.stop(stopAt); o3.stop(stopAt);
    },

    pad_air: (when, out, freqs, dur, params) => {
        params = params || {};
        const color = params.color || 'pink';
        const centerMult = params.centerMult || 4;   // ride a higher harmonic so noise actually passes
        const Q = params.Q || 6;                     // wider band = audible
        const gainMult = params.gainMult || 1.0;
        const peak = (0.32 / freqs.length) * gainMult;
        const modHz = params.modHz || 0;
        const modDepth = params.modDepth || 0;
        const lowMix = params.lowMix !== undefined ? params.lowMix : 0.35; // a little fundamental band, too
        freqs.forEach(freq => {
            const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer(color, 2); n.loop = true;
            const fHi = ctx.createBiquadFilter(); fHi.type = 'bandpass';
            fHi.frequency.value = Math.min(freq * centerMult, 8000); fHi.Q.value = Q;
            const fLo = ctx.createBiquadFilter(); fLo.type = 'bandpass';
            fLo.frequency.value = freq; fLo.Q.value = Math.max(2, Q * 0.6);
            const fLoG = ctx.createGain(); fLoG.gain.value = lowMix;
            const env = ctx.createGain();
            env.gain.setValueAtTime(0, when);
            env.gain.linearRampToValueAtTime(peak, when + dur * 0.3);
            env.gain.setValueAtTime(peak, when + dur * 0.7);
            env.gain.linearRampToValueAtTime(0, when + dur);
            n.connect(fHi); fHi.connect(env);
            n.connect(fLo); fLo.connect(fLoG); fLoG.connect(env);
            const stopAt = when + dur + 0.05;
            n.start(when); n.stop(stopAt);
            if (modHz) {
                const trem = ctx.createGain(); trem.gain.value = 1.0;
                const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = modHz;
                const lfoG = ctx.createGain(); lfoG.gain.value = modDepth;
                lfo.connect(lfoG); lfoG.connect(trem.gain);
                env.disconnect();
                env.connect(trem); trem.connect(out);
                lfo.start(when); lfo.stop(stopAt);
            } else {
                env.connect(out);
            }
        });
    },

    thump: (when, out, vel) => {
        const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('brown', 0.3);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240; f.Q.value = 1;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.45, when + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(when); n.stop(when + 0.2);
    },

    snap: (when, out, vel) => {
        const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.2);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 1;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.18, when + 0.003);
        env.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(when); n.stop(when + 0.12);
    },

    swoosh: (when, out, dur) => {
        const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 4);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5;
        f.frequency.setValueAtTime(400, when);
        f.frequency.exponentialRampToValueAtTime(2200, when + dur * 0.45);
        f.frequency.exponentialRampToValueAtTime(300, when + dur);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(0.28, when + dur * 0.3);
        env.gain.linearRampToValueAtTime(0, when + dur);
        n.connect(f); f.connect(env); env.connect(out);
        n.start(when); n.stop(when + dur);
    },

    // --- Bespoke iconic voices ---

    // Mirage: high shimmery sine + slow 6Hz vibrato, gentle long swell
    mirage_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
        const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 6;
        const vibG = ctx.createGain(); vibG.gain.value = freq * 0.012;
        vib.connect(vibG); vibG.connect(o.frequency);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.30, when + dur * 0.4);
        env.gain.setValueAtTime(vel * 0.18, when + dur * 0.7);
        env.gain.linearRampToValueAtTime(0, when + dur);
        o.connect(env); env.connect(out);
        o.start(when); vib.start(when);
        const stopAt = when + dur + 0.05;
        o.stop(stopAt); vib.stop(stopAt);
    },

    // Celestial: like mirage but with sub octave for depth
    celestial_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
        const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = freq * 0.5;
        const subG = ctx.createGain(); subG.gain.value = 0.4;
        const vib = ctx.createOscillator(); vib.frequency.value = 5;
        const vibG = ctx.createGain(); vibG.gain.value = freq * 0.008;
        vib.connect(vibG); vibG.connect(o.frequency); vibG.connect(sub.frequency);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.32, when + dur * 0.5);
        env.gain.setValueAtTime(vel * 0.2, when + dur * 0.75);
        env.gain.linearRampToValueAtTime(0, when + dur);
        o.connect(env); sub.connect(subG); subG.connect(env); env.connect(out);
        o.start(when); sub.start(when); vib.start(when);
        const stopAt = when + dur + 0.05;
        o.stop(stopAt); sub.stop(stopAt); vib.stop(stopAt);
    },

    // Ghost: formant-FM vocal + breath noise
    ghost_voice: (when, out, freq, dur, vel) => {
        const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq;
        const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * 1.7;
        const modG = ctx.createGain(); modG.gain.value = freq * 0.6;
        mod.connect(modG); modG.connect(car.frequency);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.value = freq * 1.4; f.Q.value = 6;
        const breath = ctx.createBufferSource(); breath.buffer = createNoiseBuffer('white', 2);
        breath.loop = true;
        const breathG = ctx.createGain(); breathG.gain.value = 0;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.24, when + dur * 0.3);
        env.gain.setValueAtTime(vel * 0.14, when + dur * 0.7);
        env.gain.linearRampToValueAtTime(0, when + dur);
        breathG.gain.setValueAtTime(0, when);
        breathG.gain.linearRampToValueAtTime(vel * 0.04, when + dur * 0.3);
        breathG.gain.linearRampToValueAtTime(0, when + dur);
        car.connect(f); f.connect(env); env.connect(out);
        breath.connect(breathG); breathG.connect(out);
        car.start(when); mod.start(when); breath.start(when);
        const stopAt = when + dur + 0.05;
        car.stop(stopAt); mod.stop(stopAt); breath.stop(stopAt);
    },

    // Owl: sine with a small downward glide, gentler than the original
    owl_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(freq, when);
        o.frequency.exponentialRampToValueAtTime(freq * 0.94, when + dur * 0.85);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.30, when + 0.04);
        env.gain.setValueAtTime(vel * 0.2, when + dur * 0.6);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(env); env.connect(out);
        o.start(when); o.stop(when + dur + 0.05);
    },

    // Whale: long sine with melodic glide and lowpass — moan that lands on a pitch
    whale_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(freq * 0.85, when);
        o.frequency.linearRampToValueAtTime(freq, when + dur * 0.4);
        o.frequency.linearRampToValueAtTime(freq * 0.95, when + dur);
        const vib = ctx.createOscillator(); vib.frequency.value = 3;
        const vibG = ctx.createGain(); vibG.gain.value = freq * 0.008;
        vib.connect(vibG); vibG.connect(o.frequency);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 4; f.Q.value = 1;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.32, when + dur * 0.3);
        env.gain.setValueAtTime(vel * 0.32, when + dur * 0.7);
        env.gain.linearRampToValueAtTime(0, when + dur);
        o.connect(f); f.connect(env); env.connect(out);
        o.start(when); vib.start(when);
        const stopAt = when + dur + 0.05;
        o.stop(stopAt); vib.stop(stopAt);
    },

    // Dolphin: quick high clicks, then a brief frequency squeak
    dolphin_voice: (when, out, freq, dur, vel) => {
        // Clicks at the freq's high overtone for clarity
        const clickFreq = Math.min(freq * 6, 8000);
        for (let i = 0; i < 3; i++) {
            const t = when + i * 0.025;
            const c = ctx.createOscillator(); c.type = 'sine'; c.frequency.value = clickFreq + i * 200;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(vel * 0.16, t + 0.002);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
            c.connect(g); g.connect(out);
            c.start(t); c.stop(t + 0.015);
        }
        // Squeak — sweep around the note
        const sw = ctx.createOscillator(); sw.type = 'sine';
        const t = when + 0.1;
        sw.frequency.setValueAtTime(freq * 2, t);
        sw.frequency.linearRampToValueAtTime(freq * 3, t + dur * 0.2);
        sw.frequency.linearRampToValueAtTime(freq * 2.2, t + dur * 0.5);
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0, t);
        sg.gain.linearRampToValueAtTime(vel * 0.2, t + 0.02);
        sg.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.5);
        sw.connect(sg); sg.connect(out);
        sw.start(t); sw.stop(t + dur * 0.6);
    },

    // Seagull: sine with rapid vibrato, slight upward bend, caw character
    seagull_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(freq * 0.95, when);
        o.frequency.exponentialRampToValueAtTime(freq * 1.08, when + dur * 0.3);
        o.frequency.exponentialRampToValueAtTime(freq, when + dur * 0.8);
        const vib = ctx.createOscillator(); vib.frequency.value = 22;
        const vibG = ctx.createGain(); vibG.gain.value = freq * 0.04;
        vib.connect(vibG); vibG.connect(o.frequency);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.28, when + dur * 0.15);
        env.gain.setValueAtTime(vel * 0.16, when + dur * 0.7);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(env); env.connect(out);
        o.start(when); vib.start(when);
        const stopAt = when + dur + 0.05;
        o.stop(stopAt); vib.stop(stopAt);
    },

    // Eagle: sawtooth + bandpass + vibrato — theremin/screech feel
    eagle_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
        const vib = ctx.createOscillator(); vib.frequency.value = 9;
        const vibG = ctx.createGain(); vibG.gain.value = freq * 0.025;
        vib.connect(vibG); vibG.connect(o.frequency);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.value = freq * 1.5; f.Q.value = 4;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.24, when + dur * 0.15);
        env.gain.setValueAtTime(vel * 0.13, when + dur * 0.7);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(f); f.connect(env); env.connect(out);
        o.start(when); vib.start(when);
        const stopAt = when + dur + 0.05;
        o.stop(stopAt); vib.stop(stopAt);
    },

    // Bowl: 4 inharmonic sine partials, long warm decay
    bowl_voice: (when, out, freq, dur, vel) => {
        [1, 2.4, 3.8, 5.2].forEach((r, i) => {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * r;
            const vib = ctx.createOscillator(); vib.frequency.value = 3 + i * 0.5;
            const vibG = ctx.createGain(); vibG.gain.value = freq * r * 0.003;
            vib.connect(vibG); vibG.connect(o.frequency);
            const env = ctx.createGain();
            env.gain.setValueAtTime(0, when);
            env.gain.linearRampToValueAtTime(vel * 0.26 / (i + 1), when + 0.005);
            env.gain.exponentialRampToValueAtTime(0.001, when + dur - i * 0.2);
            o.connect(env); env.connect(out);
            o.start(when); vib.start(when);
            const stopAt = when + dur + 0.05;
            o.stop(stopAt); vib.stop(stopAt);
        });
    },

    // Alarm: square alternating between the note and a perfect 4th below — two-tone alarm
    alarm_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'square';
        const f2 = freq * 0.75; // perfect 4th below
        // Alternate every (dur/4)
        const slice = dur / 4;
        o.frequency.setValueAtTime(freq, when);
        o.frequency.setValueAtTime(f2, when + slice);
        o.frequency.setValueAtTime(freq, when + slice * 2);
        o.frequency.setValueAtTime(f2, when + slice * 3);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.18, when + 0.01);
        env.gain.setValueAtTime(vel * 0.08, when + dur * 0.92);
        env.gain.linearRampToValueAtTime(0, when + dur);
        o.connect(env); env.connect(out);
        o.start(when); o.stop(when + dur + 0.05);
    },

    // Cicada: triangle with mild tremolo, scale-locked
    cicada_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
        const am = ctx.createOscillator(); am.frequency.value = 16;
        const amG = ctx.createGain(); amG.gain.value = 0.3;
        const env = ctx.createGain(); env.gain.value = 0;
        am.connect(amG); amG.connect(env.gain);
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.22, when + dur * 0.15);
        env.gain.setValueAtTime(vel * 0.1, when + dur * 0.75);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(env); env.connect(out);
        o.start(when); am.start(when);
        const stopAt = when + dur + 0.05;
        o.stop(stopAt); am.stop(stopAt);
    },

    // Frog: short pitched pluck with downward sweep — percussive but tonal
    frog_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(freq * 1.3, when);
        o.frequency.exponentialRampToValueAtTime(freq, when + 0.05);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.25, when + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, when + Math.min(dur, 0.18));
        o.connect(env); env.connect(out);
        o.start(when); o.stop(when + 0.2);
    },

    // Sonar: classic ping — sine with quick attack + slight pitch dip + long decay
    sonar_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(freq, when);
        o.frequency.exponentialRampToValueAtTime(freq * 0.96, when + dur * 0.5);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.22, when + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(env); env.connect(out);
        o.start(when); o.stop(when + dur + 0.05);
    },

    // Buoy: like bell but softer/warmer with slight vibrato
    buoy_voice: (when, out, freq, dur, vel) => {
        const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
        const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = freq * 3;
        const g2 = ctx.createGain(); g2.gain.value = 0.25;
        const g3 = ctx.createGain(); g3.gain.value = 0.08;
        const vib = ctx.createOscillator(); vib.frequency.value = 4;
        const vibG = ctx.createGain(); vibG.gain.value = freq * 0.005;
        vib.connect(vibG); vibG.connect(o1.frequency);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.22, when + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o1.connect(env); o2.connect(g2); g2.connect(env); o3.connect(g3); g3.connect(env);
        env.connect(out);
        o1.start(when); o2.start(when); o3.start(when); vib.start(when);
        const stopAt = when + dur + 0.05;
        o1.stop(stopAt); o2.stop(stopAt); o3.stop(stopAt); vib.stop(stopAt);
    },

    // Neon: bright synth-lead — sawtooth through resonant lowpass that opens
    neon_voice: (when, out, freq, dur, vel) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.005;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 5;
        f.frequency.setValueAtTime(freq * 1.2, when);
        f.frequency.linearRampToValueAtTime(freq * 4.5, when + 0.06);
        f.frequency.exponentialRampToValueAtTime(freq * 1.5, when + dur);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.24, when + 0.02);
        env.gain.setValueAtTime(vel * 0.14, when + dur * 0.7);
        env.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(f); o2.connect(f); f.connect(env); env.connect(out);
        o.start(when); o2.start(when);
        const stopAt = when + dur + 0.05;
        o.stop(stopAt); o2.stop(stopAt);
    },

    // --- soundStrider-inspired instrument voices ---

    // Marimba: filtered additive triangles at 1x and 3x harmonic
    marimba: (when, out, freq, dur, vel) => {
        const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = freq;
        const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = freq * 3;
        const g3 = ctx.createGain(); g3.gain.value = 0.55;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.value = freq * 1.6; f.Q.value = 0.6;
        const env = ctx.createGain();
        const dec = Math.min(dur, 1.4);
        env.gain.setValueAtTime(0, when);
        env.gain.exponentialRampToValueAtTime(vel * 0.32, when + 0.01);
        env.gain.exponentialRampToValueAtTime(vel * 0.04, when + Math.min(dec, 1.0));
        env.gain.linearRampToValueAtTime(0.0001, when + dec);
        o1.connect(env); o3.connect(g3); g3.connect(env); env.connect(f); f.connect(out);
        o1.start(when); o3.start(when);
        const stopAt = when + dec + 0.05;
        o1.stop(stopAt); o3.stop(stopAt);
    },

    // Piano: FM "click" attack + triangle/sawtooth FM body through 4x lowpass
    piano: (when, out, freq, dur, vel) => {
        // Click — triangle modulator at 1.5x, depth = freq/2
        const carClick = ctx.createOscillator(); carClick.type = 'sine'; carClick.frequency.value = freq;
        const modClick = ctx.createOscillator(); modClick.type = 'triangle'; modClick.frequency.value = freq * 1.5;
        const modClickG = ctx.createGain(); modClickG.gain.value = freq / 2;
        modClick.connect(modClickG); modClickG.connect(carClick.frequency);
        const clickEnv = ctx.createGain();
        clickEnv.gain.setValueAtTime(0, when);
        clickEnv.gain.exponentialRampToValueAtTime(vel * 0.32, when + 0.012);
        clickEnv.gain.exponentialRampToValueAtTime(0.0001, when + 0.45);
        carClick.connect(clickEnv); clickEnv.connect(out);

        // Body — triangle carrier with sawtooth FM at 3x, depth = freq, lowpass at 4x
        const carBody = ctx.createOscillator(); carBody.type = 'triangle'; carBody.frequency.value = freq;
        const modBody = ctx.createOscillator(); modBody.type = 'sawtooth'; modBody.frequency.value = freq * 3;
        const modBodyG = ctx.createGain(); modBodyG.gain.value = freq;
        modBody.connect(modBodyG); modBodyG.connect(carBody.frequency);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.value = freq * 4; f.Q.value = 0.6;
        const bodyEnv = ctx.createGain();
        const bodyDur = Math.min(dur, 5.5);
        bodyEnv.gain.setValueAtTime(0, when);
        bodyEnv.gain.exponentialRampToValueAtTime(vel * 0.16, when + 0.012);
        bodyEnv.gain.linearRampToValueAtTime(0.0001, when + bodyDur);
        carBody.connect(f); f.connect(bodyEnv); bodyEnv.connect(out);

        carClick.start(when); modClick.start(when); carBody.start(when); modBody.start(when);
        const clickStop = when + 0.5;
        const bodyStop = when + bodyDur + 0.05;
        carClick.stop(clickStop); modClick.stop(clickStop);
        carBody.stop(bodyStop); modBody.stop(bodyStop);
    },

    // Vibraphone: sine + 4th harmonic with 5Hz tremolo
    vibraphone: (when, out, freq, dur, vel) => {
        const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
        const o4 = ctx.createOscillator(); o4.type = 'sine'; o4.frequency.value = freq * 4;
        const g4 = ctx.createGain(); g4.gain.value = 0.28;
        const env = ctx.createGain();
        const dec = Math.min(dur, 3);
        env.gain.setValueAtTime(0, when);
        env.gain.exponentialRampToValueAtTime(vel * 0.3, when + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, when + dec);
        // Tremolo on a separate gain in series
        const tremGain = ctx.createGain(); tremGain.gain.value = 0.7;
        const trem = ctx.createOscillator(); trem.type = 'sine'; trem.frequency.value = 5;
        const tremDepth = ctx.createGain(); tremDepth.gain.value = 0.3;
        trem.connect(tremDepth); tremDepth.connect(tremGain.gain);
        o1.connect(env); o4.connect(g4); g4.connect(env);
        env.connect(tremGain); tremGain.connect(out);
        o1.start(when); o4.start(when); trem.start(when);
        const stopAt = when + dec + 0.05;
        o1.stop(stopAt); o4.stop(stopAt); trem.stop(stopAt);
    },

    // Glockenspiel: bright bell — sine + 4th harmonic with very fast attack
    glockenspiel: (when, out, freq, dur, vel) => {
        const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 4;
        const g2 = ctx.createGain(); g2.gain.value = 0.32;
        const env = ctx.createGain();
        const dec = Math.min(dur, 1.0);
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.28, when + 0.003);
        env.gain.exponentialRampToValueAtTime(0.0001, when + dec);
        o1.connect(env); o2.connect(g2); g2.connect(env); env.connect(out);
        o1.start(when); o2.start(when);
        const stopAt = when + dec + 0.05;
        o1.stop(stopAt); o2.stop(stopAt);
    },

    // Harp: sine + 2nd-harmonic triangle through filter that closes — silky pluck
    harp: (when, out, freq, dur, vel) => {
        const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2;
        const g2 = ctx.createGain(); g2.gain.value = 0.22;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(Math.min(freq * 8, 5500), when);
        f.frequency.exponentialRampToValueAtTime(Math.min(freq * 2, 1400), when + Math.min(dur, 1.6) * 0.7);
        f.Q.value = 0.5;
        const env = ctx.createGain();
        const dec = Math.min(dur, 1.6);
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.36, when + 0.005);
        env.gain.exponentialRampToValueAtTime(0.0001, when + dec);
        o1.connect(env); o2.connect(g2); g2.connect(env); env.connect(f); f.connect(out);
        o1.start(when); o2.start(when);
        const stopAt = when + dec + 0.05;
        o1.stop(stopAt); o2.stop(stopAt);
    },

    // Organ: additive sines (1, 2, 3, 4) with sustained envelope
    organ: (when, out, freq, dur, vel) => {
        const harmonics = [
            { ratio: 1, gain: 1.0 },
            { ratio: 2, gain: 0.55 },
            { ratio: 3, gain: 0.3 },
            { ratio: 4, gain: 0.18 }
        ];
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(vel * 0.26, when + 0.025);
        env.gain.setValueAtTime(vel * 0.16, when + dur * 0.85);
        env.gain.linearRampToValueAtTime(0, when + dur);
        const oscs = [];
        harmonics.forEach(h => {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * h.ratio;
            const g = ctx.createGain(); g.gain.value = h.gain;
            o.connect(g); g.connect(env);
            oscs.push(o);
        });
        env.connect(out);
        oscs.forEach(o => o.start(when));
        const stopAt = when + dur + 0.05;
        oscs.forEach(o => o.stop(stopAt));
    },

    // Pad (Soft): layered slightly-detuned sines, slow attack
    pad_soft: (when, out, freqs, dur, params) => {
        params = params || {};
        const detune = params.detune || 1.005;
        const gainMult = params.gainMult || 1.0;
        const peak = (0.18 / freqs.length) * gainMult;
        const harmonic = params.harmonic || 0;
        const harmonicGain = params.harmonicGain || 0.18;
        const wobbleHz = params.wobbleHz || 0;
        const wobbleDepth = params.wobbleDepth || 0;
        const lowpassMult = params.lowpassMult || 0;  // 0 = no filter
        freqs.forEach(freq => {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
            const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * detune;
            const env = ctx.createGain();
            env.gain.setValueAtTime(0, when);
            env.gain.linearRampToValueAtTime(peak, when + dur * 0.4);
            env.gain.setValueAtTime(peak, when + dur * 0.7);
            env.gain.linearRampToValueAtTime(0, when + dur);
            o.connect(env); o2.connect(env);
            const stopAt = when + dur + 0.05;
            o.start(when); o2.start(when);
            o.stop(stopAt); o2.stop(stopAt);
            if (harmonic) {
                const oh = ctx.createOscillator(); oh.type = 'sine'; oh.frequency.value = freq * harmonic;
                const gh = ctx.createGain(); gh.gain.value = harmonicGain;
                oh.connect(gh); gh.connect(env);
                oh.start(when); oh.stop(stopAt);
            }
            if (wobbleHz) {
                const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = wobbleHz;
                const lfoG = ctx.createGain(); lfoG.gain.value = freq * wobbleDepth;
                lfo.connect(lfoG); lfoG.connect(o.frequency); lfoG.connect(o2.frequency);
                lfo.start(when); lfo.stop(stopAt);
            }
            if (lowpassMult) {
                const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
                lp.frequency.value = freq * lowpassMult; lp.Q.value = 0.6;
                env.connect(lp); lp.connect(out);
            } else {
                env.connect(out);
            }
        });
    },

    // Pad (Bright): detuned sawtooths through a high-Q lowpass that opens
    pad_bright: (when, out, freqs, dur, params) => {
        params = params || {};
        const detune = params.detune || 1.007;
        const cutoffMult = params.cutoffMult || 1.0;
        const gainMult = params.gainMult || 1.0;
        const peak = (0.16 / freqs.length) * gainMult;
        freqs.forEach(freq => {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
            const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * detune;
            const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.5;
            f.frequency.setValueAtTime(Math.min(freq * 1.5 * cutoffMult, 1200), when);
            f.frequency.linearRampToValueAtTime(Math.min(freq * 5 * cutoffMult, 6000), when + dur * 0.4);
            f.frequency.linearRampToValueAtTime(Math.min(freq * 2 * cutoffMult, 2000), when + dur);
            const env = ctx.createGain();
            env.gain.setValueAtTime(0, when);
            env.gain.linearRampToValueAtTime(peak, when + dur * 0.3);
            env.gain.setValueAtTime(peak, when + dur * 0.7);
            env.gain.linearRampToValueAtTime(0, when + dur);
            o.connect(f); o2.connect(f); f.connect(env); env.connect(out);
            o.start(when); o2.start(when);
            const stopAt = when + dur + 0.05;
            o.stop(stopAt); o2.stop(stopAt);
        });
    },

    // Tesla: filtered electrical zap — bright noise burst with low pulse
    tesla_voice: (when, out, freq, dur, vel) => {
        const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('white', 0.3);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.value = 2500 + Math.random() * 1500; f.Q.value = 4;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0, when);
        ng.gain.linearRampToValueAtTime(vel * 0.2, when + 0.005);
        ng.gain.exponentialRampToValueAtTime(0.001, when + dur);
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
        const og = ctx.createGain();
        og.gain.setValueAtTime(0, when);
        og.gain.linearRampToValueAtTime(vel * 0.14, when + 0.005);
        og.gain.exponentialRampToValueAtTime(0.001, when + dur);
        n.connect(f); f.connect(ng); ng.connect(out);
        o.connect(og); og.connect(out);
        n.start(when); o.start(when);
        n.stop(when + dur + 0.05); o.stop(when + dur + 0.05);
    }
};

// ----- Entity definition helper -----

const TOTAL_ROLE_DEFAULTS = {
    lead:  { oct: 1,  range: [4, 14],  density: 0.5,  len: 16, step: 2, gain: 0.85, life: [10, 24], motion: 'wander' },
    bass:  { oct: -1, range: [-3, 4],  density: 0.4,  len: 16, step: 4, gain: 0.85, life: [12, 28], motion: 'hover'  },
    pad:   { oct: 0,  range: [0, 6],   density: 1.0,  len: 16, step: 8, gain: 1.05, life: [16, 36], motion: 'orbit'  },
    arp:   { oct: 2,  range: [0, 14],  density: 0.6,  len: 16, step: 1, gain: 0.7,  life: [6, 14],  motion: 'orbit'  },
    perc:  { oct: 0,  range: [0, 0],   density: 0.5,  len: 16, step: 2, gain: 0.85, life: [10, 24], motion: 'orbit'  },
    flyby: { oct: 0,  range: [0, 0],   density: 1,    len: 1,  step: 1, gain: 0.9,  life: [4, 8],   motion: 'flyby'  }
};
function mkE(role, voice, opts) {
    return Object.assign({ role, voice }, TOTAL_ROLE_DEFAULTS[role], opts || {});
}

// ----- Entity registry -----

const TOTAL_ENTITIES = {
    // Forest
    bird:               mkE('lead', 'flute',        { range: [7, 18], density: 0.45, len: 16, step: 1 }),
    cicada:             mkE('lead', 'cicada_voice', { oct: 2, range: [4, 11], density: 0.55, len: 16, step: 2, gain: 0.95 }),
    frog:               mkE('lead', 'frog_voice',   { oct: 0, range: [-3, 4], density: 0.55, len: 16, step: 2, gain: 0.8 }),
    canopy:             mkE('pad',  'pad_air',      { len: 12, step: 8, gain: 1.0, voiceParams: { color: 'pink', centerMult: 3, Q: 5, lowMix: 0.4 } }),
    owl:                mkE('lead', 'owl_voice',    { oct: 0, range: [3, 9], density: 0.35, len: 16, step: 4, gain: 0.85 }),
    forest_ape:         mkE('bass', 'horn',         { density: 0.35, len: 16, step: 4 }),
    forest_jaguar:      mkE('lead', 'wail',         { oct: 0, range: [3, 9], density: 0.4, len: 16, step: 4, gain: 0.7 }),
    music_box:          mkE('arp',  'glockenspiel', { oct: 3, range: [0, 14], density: 0.5, len: 16, step: 2, gain: 0.7 }),
    wind_voice:         mkE('lead', 'breathy',      { oct: 1, density: 0.45, len: 16, step: 4, gain: 1.3, voiceParams: { color: 'pink', centerMult: 1.4, Q: 4, harmonic2: 2.5, gainMult: 1.0, tremHz: 0.6, tremDepth: 0.4 } }),

    // Storm
    thunder:            mkE('perc', 'kick',      { density: 0.3,  len: 16, step: 4 }),
    lightning:          mkE('perc', 'snap',      { density: 0.55, len: 12, step: 1, gain: 0.6 }),
    downpour:           mkE('flyby','swoosh',    { life: [4, 8] }),
    roll:               mkE('perc', 'thump',     { density: 0.3,  len: 16, step: 8 }),
    rattlesnake:        mkE('perc', 'click',     { density: 0.7,  len: 8,  step: 1 }),
    vulture:            mkE('lead', 'owl_voice',    { oct: 0, range: [3, 9], density: 0.35, len: 16, step: 4 }),
    guizer:             mkE('pad',  'pad_air',      { oct: 1, len: 12, step: 8, gain: 1.0, voiceParams: { color: 'white', centerMult: 8, Q: 4, lowMix: 0.15, modHz: 3.5, modDepth: 0.25 } }),
    mirage:             mkE('lead', 'mirage_voice', { oct: 2, range: [3, 9], density: 0.4, len: 16, step: 4, gain: 1.15 }),
    scorpion:           mkE('arp',  'marimba',   { oct: 2, density: 0.55, len: 32, step: 1, gain: 1.0 }),
    crab:               mkE('arp',  'marimba',   { oct: 1, density: 0.6, len: 32, step: 1, gain: 1.0 }),

    // Mountain
    chimes:             mkE('arp',  'vibraphone',  { oct: 2, density: 0.55, len: 16, step: 2, gain: 0.7 }),
    bowl:               mkE('lead', 'bowl_voice',  { oct: 1, range: [0, 9], density: 0.3, len: 16, step: 8, gain: 0.85 }),
    eagle:              mkE('lead', 'eagle_voice', { oct: 1, range: [4, 11], density: 0.35, len: 16, step: 4, gain: 0.85 }),
    rockfall:           mkE('perc', 'thump',     { density: 0.5, len: 16, step: 2, gain: 1.1 }),
    goat:               mkE('lead', 'flute',     { oct: 0, range: [2, 9], density: 0.4, len: 12, step: 4 }),
    crystal_bell:       mkE('arp',  'glockenspiel',{ oct: 2, density: 0.5,  len: 16, step: 2, gain: 0.7 }),
    note_flurry:        mkE('arp',  'pluck',     { oct: 2, density: 0.7,  len: 32, step: 1 }),
    mountain_gust:      mkE('flyby','swoosh',    { life: [5, 10] }),
    mountain_quake:     mkE('perc', 'kick',      { density: 0.2,  len: 16, step: 8 }),

    // Beach
    seagull:            mkE('lead', 'seagull_voice',{ oct: 1, range: [4, 12], density: 0.4, len: 16, step: 2, gain: 0.85 }),
    fog_horn:           mkE('bass', 'horn',         { range: [0, 4], density: 0.4, len: 8, step: 4, gain: 0.95 }),
    buoy:               mkE('lead', 'buoy_voice',   { oct: 1, range: [0, 9], density: 0.4, len: 16, step: 2, gain: 0.85 }),
    tide:               mkE('pad',  'pad_air',   { oct: -1, len: 16, step: 8, voiceParams: { color: 'brown', centerMult: 2, Q: 4, lowMix: 0.6, modHz: 0.18, modDepth: 0.5 } }),
    beach_wave:         mkE('pad',  'pad_air',   { len: 12, step: 8, gain: 0.95, voiceParams: { color: 'brown', centerMult: 3, Q: 5, lowMix: 0.4, modHz: 0.4, modDepth: 0.4 } }),

    // Aquatic
    whale:              mkE('lead', 'whale_voice',  { oct: -1, range: [0, 7], density: 0.25, len: 16, step: 8, gain: 1.0 }),
    dolphin:            mkE('lead', 'dolphin_voice',{ oct: 2, range: [4, 14], density: 0.5,  len: 16, step: 2 }),
    sonar:              mkE('arp',  'sonar_voice',  { oct: 1, density: 0.5,  len: 16, step: 2, gain: 0.85 }),
    submarine:          mkE('bass', 'sub',       { oct: -1, density: 0.35, len: 16, step: 4, gain: 1.05 }),
    barracuda:          mkE('arp',  'marimba',   { oct: 1, density: 0.55, len: 16, step: 2, gain: 0.7 }),
    clam:               mkE('pad',  'pad_warm',  { oct: -1, len: 16, step: 8, voiceParams: { detune: 1.014, gainMult: 1.1 } }),
    aquatic_ripple:     mkE('arp',  'harp',      { oct: 2, density: 0.55, len: 32, step: 1, gain: 0.65 }),

    // Astral
    aurora:             mkE('lead', 'mirage_voice',    { oct: 1, range: [4, 11], density: 0.3, len: 16, step: 4, gain: 0.85 }),
    celestial:          mkE('lead', 'celestial_voice', { oct: 0, range: [0, 7], density: 0.3, len: 16, step: 8, gain: 0.95 }),
    starfield:          mkE('arp',  'glockenspiel',{ oct: 2, density: 0.6,  len: 32, step: 1, gain: 0.7 }),
    glitter:            mkE('arp',  'harp',      { oct: 3, density: 0.55, len: 32, step: 1, gain: 0.65 }),
    astral_dust:        mkE('arp',  'glockenspiel',{ oct: 3, density: 0.45, len: 32, step: 1, gain: 0.55 }),
    astral_terrestrial: mkE('pad',  'pad_warm',  { oct: 1, len: 16, step: 8, voiceParams: { detune: 1.008, harmonic: 4, harmonicGain: 0.25, gainMult: 1.05 } }),
    quasar:             mkE('pad',  'pad_bright',{ len: 16, step: 8, gain: 1.1, voiceParams: { detune: 1.011, cutoffMult: 1.25, gainMult: 1.5 } }),
    warp:               mkE('arp',  'harp',      { oct: 2, density: 0.6,  len: 32, step: 1 }),
    ion:                mkE('arp',  'glockenspiel',{ oct: 2, density: 0.5,  len: 32, step: 1, gain: 0.55 }),
    singularity:        mkE('bass', 'sub',       { oct: -2, density: 0.3, len: 16, step: 8 }),
    ghost:              mkE('lead', 'ghost_voice',   { oct: 1, range: [3, 9], density: 0.25, len: 16, step: 4, gain: 0.85 }),
    comet:              mkE('pad',  'pad_soft',  { oct: 1, len: 16, step: 8, gain: 0.95, voiceParams: { harmonic: 5, harmonicGain: 0.18, detune: 1.004 } }),

    // Pulse
    pulsar:             mkE('bass', 'sub',       { oct: -1, range: [0, 4], density: 0.35, len: 16, step: 4, gain: 0.9, motion: 'orbit' }),
    pulse_grain:        mkE('arp',  'harp',          { oct: 2, density: 0.6,  len: 32, step: 1 }),
    pulse_beacon:       mkE('arp',  'glockenspiel',  { oct: 2, density: 0.5,  len: 16, step: 2, gain: 0.7 }),

    // Urban
    metro:              mkE('perc', 'thump',         { density: 0.5,  len: 16, step: 2 }),
    radio:              mkE('lead', 'organ',         { oct: 0, range: [3, 9], density: 0.35, len: 16, step: 4, gain: 0.55 }),
    traffic:            mkE('pad',  'pad_soft',      { len: 16, step: 8, gain: 0.95, voiceParams: { detune: 1.006, lowpassMult: 0.6, gainMult: 1.05 } }),
    neon:               mkE('lead', 'neon_voice',    { oct: 1, range: [3, 9], density: 0.4, len: 16, step: 2, gain: 0.8 }),
    siren:              mkE('lead', 'breathy',       { oct: 1, range: [4, 11], density: 0.35, len: 16, step: 4, gain: 0.85, voiceParams: { color: 'pink', centerMult: 1.5, Q: 5, harmonic2: 1.6, sweepMult: 1.4 } }),
    talker:             mkE('lead', 'talker',        { oct: 0, range: [-3, 4], density: 0.3, len: 16, step: 8, gain: 1.0 }),

    // Industrial
    piston:             mkE('perc', 'thump',         { density: 0.55, len: 16, step: 2 }),
    conveyor:           mkE('perc', 'click',         { density: 0.55, len: 8,  step: 2 }),
    generator:          mkE('pad',  'pad_air',       { len: 16, step: 8, gain: 0.95, voiceParams: { color: 'brown', centerMult: 1.5, Q: 7, lowMix: 0.7, modHz: 6, modDepth: 0.2 } }),
    tesla:              mkE('arp',  'tesla_voice',   { oct: 2, density: 0.5,  len: 32, step: 1, gain: 0.7 }),
    alarm:              mkE('lead', 'alarm_voice',   { oct: 1, range: [3, 9], density: 0.3,  len: 8,  step: 4, gain: 0.7 }),
    industrial_ground:  mkE('bass', 'sub',       { oct: -1, density: 0.4, len: 16, step: 4 }),

    // Tundra
    wolf:               mkE('lead', 'whale_voice', { oct: 0, range: [3, 9], density: 0.3, len: 16, step: 4, gain: 0.85 }),
    glacier:            mkE('bass', 'sub',       { oct: -1, density: 0.35, len: 16, step: 8 }),
    blizzard:           mkE('pad',  'pad_air',       { oct: 1, len: 16, step: 8, gain: 0.95, voiceParams: { color: 'white', centerMult: 6, Q: 3, lowMix: 0.2, modHz: 0.7, modDepth: 0.5 } }),
    frost:              mkE('arp',  'glockenspiel',  { oct: 2, density: 0.5,  len: 32, step: 1, gain: 0.6 }),
    tundra_hare:        mkE('arp',  'marimba',       { oct: 2, density: 0.5,  len: 16, step: 2, gain: 0.7 }),
    tundra_ox:          mkE('bass', 'horn',          { range: [0, 4], density: 0.4, len: 8, step: 4 }),
    tundra_snow:        mkE('pad',  'pad_soft',      { oct: 1, len: 16, step: 8, gain: 0.9, voiceParams: { harmonic: 8, harmonicGain: 0.12, detune: 1.005 } }),

    // Elemental / volcanic
    eruption:           mkE('perc', 'kick',      { density: 0.3,  len: 16, step: 4 }),
    lavaflow:           mkE('pad',  'pad_warm',  { oct: -1, len: 16, step: 8, gain: 1.0, voiceParams: { detune: 1.012, wobbleHz: 0.4, wobbleDepth: 0.008, gainMult: 1.1 } }),
    rumble:             mkE('perc', 'thump',     { density: 0.4,  len: 16, step: 4 }),
    hiss:               mkE('pad',  'pad_air',   { oct: 1, len: 16, step: 8, gain: 0.9, voiceParams: { color: 'white', centerMult: 5, Q: 2.5, lowMix: 0.1, gainMult: 1.0 } }),
    ember:              mkE('arp',  'harp',      { oct: 2, density: 0.5,  len: 32, step: 1, gain: 0.55 }),

    // Limbic
    limbic_heart:       mkE('perc', 'kick',      { density: 0.35, len: 16, step: 4 }),
    limbic_larynx:      mkE('lead', 'breathy',   { oct: 0, density: 0.3,  len: 16, step: 4, gain: 1.0, voiceParams: { color: 'pink', centerMult: 1, Q: 7, harmonic2: 2.4, gainMult: 1.0, tremHz: 4, tremDepth: 0.25 } }),
    limbic_lung:        mkE('pad',  'pad_air',   { oct: -1, len: 16, step: 8, gain: 0.95, voiceParams: { color: 'brown', centerMult: 2, Q: 4, lowMix: 0.6, modHz: 0.5, modDepth: 0.5 } }),
    limbic_nerve:       mkE('arp',  'pluck',     { oct: 2, density: 0.6,  len: 32, step: 1, gain: 0.55 }),
    limbic_vessel:      mkE('bass', 'sub',       { density: 0.35, len: 16, step: 4 }),

    // Mainframe
    mainframe_keyboard: mkE('arp',  'piano',         { oct: 1, density: 0.5,  len: 16, step: 2, gain: 0.7 }),
    mainframe_modem:    mkE('arp',  'harp',          { oct: 2, density: 0.55, len: 32, step: 1 }),
    mainframe_display:  mkE('arp',  'glockenspiel',  { oct: 2, density: 0.45, len: 32, step: 1, gain: 0.55 }),
    mainframe_tape:     mkE('pad',  'pad_soft',      { len: 16, step: 8, gain: 0.95, voiceParams: { detune: 1.007, wobbleHz: 0.5, wobbleDepth: 0.012 } }),
    mainframe_widget:   mkE('arp',  'harp',          { oct: 2, density: 0.6,  len: 32, step: 1, gain: 0.6 }),
    mainframe_super:    mkE('lead', 'wail',      { oct: 1, density: 0.3, len: 16, step: 4 }),

    // Classic
    classic_bugger:     mkE('arp',  'pluck',     { oct: 1, density: 0.55,len: 16, step: 2, gain: 0.55 }),
    classic_campfire:   mkE('pad',  'pad_air',   { oct: -1, len: 16, step: 8, gain: 0.9, voiceParams: { color: 'brown', centerMult: 4, Q: 6, lowMix: 0.3, modHz: 9, modDepth: 0.6 } }),
    classic_oinker:     mkE('bass', 'horn',      { density: 0.35, len: 8,  step: 4 }),
    classic_subwoofer:  mkE('bass', 'sub',       { density: 0.35, len: 16, step: 4 }),
    classic_tweeter:    mkE('arp',  'glockenspiel',{ oct: 2, density: 0.5, len: 32, step: 1, gain: 0.55 }),
    classic_waterfall:  mkE('pad',  'pad_air',   { len: 16, step: 8, gain: 0.95, voiceParams: { color: 'white', centerMult: 5, Q: 1.8, lowMix: 0.4, gainMult: 1.0 } }),

    // Desert
    desert_dune:        mkE('pad',  'pad_soft',  { len: 16, step: 8, gain: 0.95, voiceParams: { detune: 1.014, gainMult: 1.0, wobbleHz: 0.6, wobbleDepth: 0.005 } }),
    desert_sidewinder:  mkE('lead', 'wail',      { oct: 0, density: 0.35, len: 16, step: 2 }),

    // Elemental
    elemental_tone:     mkE('lead', 'flute',     { oct: 1, density: 0.4, len: 16, step: 2 }),
    elemental_overtone: mkE('lead', 'flute',     { oct: 2, density: 0.35,len: 16, step: 4, gain: 0.6 }),
    elemental_spectre:  mkE('pad',  'pad_air',   { oct: 1, len: 16, step: 8, gain: 0.95, voiceParams: { color: 'pink', centerMult: 3.5, Q: 7, lowMix: 0.2, modHz: 1.5, modDepth: 0.35 } }),
    elemental_dither:   mkE('arp',  'harp',      { oct: 2, density: 0.55,len: 32, step: 1, gain: 0.55 }),
    elemental_tremolo:  mkE('lead', 'breathy',   { oct: 1, density: 0.4, len: 16, step: 2, gain: 0.85, voiceParams: { color: 'pink', centerMult: 1.2, Q: 5, harmonic2: 2.2, tremHz: 7, tremDepth: 0.45 } }),
    elemental_vibrato:  mkE('lead', 'flute',     { oct: 1, density: 0.4, len: 16, step: 2 }),

    // Misc
    metal_groan:        mkE('pad',  'pad_warm',  { oct: -1, len: 16, step: 8, gain: 1.0, voiceParams: { detune: 1.011, harmonic: 3.7, harmonicGain: 0.3, gainMult: 1.0 } }),
    swarm:              mkE('arp',  'harp',          { oct: 2, density: 0.7, len: 32, step: 1, gain: 0.55 }),
    deep_horn:          mkE('bass', 'horn',          { range: [0, 4], density: 0.3, len: 8, step: 4, gain: 1.0 }),
    spark_shower:       mkE('arp',  'glockenspiel',  { oct: 3, density: 0.65,len: 32, step: 1, gain: 0.55 }),
    fast_staccato:      mkE('arp',  'marimba',   { oct: 2, density: 0.7, len: 32, step: 1, gain: 0.7 })
};

// ----- Pattern generation -----

function genTotalPattern(def, overrideLen) {
    const len = overrideLen || def.len;
    const pat = new Array(len).fill(null);
    if (def.role === 'pad') {
        pat[0] = { chord: true, vel: 0.7 };
    } else if (def.role === 'flyby') {
        pat[0] = { vel: 0.8, fly: true };
    } else if (def.role === 'perc') {
        for (let i = 0; i < len; i++) {
            if (Math.random() < def.density) pat[i] = { vel: 0.5 + Math.random() * 0.5 };
        }
        // Anchor a hit on step 0 sometimes for stability
        if (Math.random() < 0.65) pat[0] = pat[0] || { vel: 0.7 };
    } else {
        // Lead / arp / bass
        for (let i = 0; i < len; i++) {
            if (Math.random() < def.density) {
                const span = def.range[1] - def.range[0];
                const deg = def.range[0] + Math.floor(Math.random() * (span + 1));
                pat[i] = { deg, vel: 0.5 + Math.random() * 0.5 };
            }
        }
        // Bass: anchor root on step 0
        if (def.role === 'bass' && !pat[0]) pat[0] = { deg: 0, vel: 0.85 };
    }
    return pat;
}

// ----- Note duration multipliers -----
const TOTAL_ROLE_DUR = { lead: 1.6, arp: 0.9, bass: 1.5, perc: 0.5 };

// ----- The system -----

function createTotalSonataSystem(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain(); mainGain.gain.value = 0.75;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    const bpm = r.bpm || 96;
    const tickTime = 60 / bpm / 8; // 32nd-note tick
    const scale = r.toneScale || [0, 2, 4, 7, 9, 11];
    const root = r.baseFreq;

    // Global shared chord progression — drives pads
    const progSeqs = [[0, 3, 4, 0], [0, 4, 3, 5], [0, 5, 3, 4], [0, 0, 4, 3]];
    let prog = progSeqs[Math.floor(Math.random() * progSeqs.length)];
    let progBar = 0;
    const ticksPerBar = 32; // 4/4 = 32 32nd notes
    const barLenSec = ticksPerBar * tickTime;

    const system = {
        mainGain, scale, root, tickTime, ticksPerBar, barLenSec,
        tick: 0,
        nextTickTime: ctx.currentTime + 0.05,
        entities: [],
        chordRoot: () => prog[progBar % prog.length]
    };

    // Voice node helper — creates panner, gain, returns nodes for an entity
    function setupEntityRouting(def, motion, lifeSec) {
        // Roles that should feel close to the listener (so they cut through the mix)
        // get smaller orbits and starting radii. Pads/bass can afford to sit further.
        const isClose = def.role === 'arp' || def.role === 'perc' ||
                        (def.role === 'lead' && def.step <= 2);
        // Start at the edge of the field so the listener perceives them
        // approaching, orbiting through, then leaving.
        const startAngle = Math.random() * Math.PI * 2;
        const startRadius = isClose ? (5 + Math.random() * 4) : (10 + Math.random() * 6);
        const sx = Math.cos(startAngle) * startRadius;
        const sy = (Math.random() - 0.5) * 4;
        const sz = Math.sin(startAngle) * startRadius;
        const panner = createHRTF(sx, sy, sz);
        const ss = createSpatialSource(panner, motion, lifeSec + 5);
        // Smaller orbit radii for close-feel entities so motion stays near the listener
        ss.radius = motion === 'flyby' ? 14 : (isClose ? (3 + Math.random() * 3) : (6 + Math.random() * 7));
        ss.startAngle = startAngle;
        // Faster motion: ~3× previous so you actually hear them arc across the field
        ss.speed = (1.2 + Math.random() * 1.5) * (0.5 + (params.flyRate || 0.5) * 1.5);
        // For wander mode the default current/target waypoints are random — override so
        // the entity starts at our chosen edge position and moves to a fresh waypoint.
        if (motion === 'wander') {
            ss.wx = sx; ss.wy = sy; ss.wz = sz;
            ss.wtx = (Math.random() - 0.5) * 18;
            ss.wty = (Math.random() - 0.5) * 6;
            ss.wtz = (Math.random() - 0.5) * 18;
            ss.wanderInterval = 4 + Math.random() * 4;
            ss.wanderTimer = 0;
        }
        const eGain = ctx.createGain(); eGain.gain.value = 0;
        eGain.connect(panner._distFilter); panner._distFilter.connect(panner); panner.connect(mainGain);
        return { panner, gain: eGain, spatial: ss };
    }

    function spawnEntity(name) {
        const def = TOTAL_ENTITIES[name];
        if (!def) return null;
        // Patterns target 4 bars in 4/4 (128 32nd-note ticks). Extend def.len if shorter.
        const TARGET_TICKS = 128;
        const patternLen = Math.max(def.len, Math.ceil(TARGET_TICKS / def.step));
        // Life: longer so a 4-bar pattern can play at least once.
        // Fly rate inversely scales life (higher = shorter, faster turnover).
        const flyMult = 1 / Math.max(0.4, 0.5 + (params.flyRate || 0.5) * 1.5);
        const lifeBase = def.life[0] * 1.6 + Math.random() * (def.life[1] - def.life[0]) * 1.6;
        const lifeSec = lifeBase * flyMult;
        const route = setupEntityRouting(def, def.motion || 'wander', lifeSec);
        const t0 = ctx.currentTime;
        const fadeIn = 1.2 + Math.random() * 1.5;
        const fadeOut = 2 + Math.random() * 2.5;
        const peak = def.gain;
        route.gain.gain.setValueAtTime(0, t0);
        route.gain.gain.linearRampToValueAtTime(peak, t0 + fadeIn);
        route.gain.gain.setValueAtTime(peak, t0 + fadeIn + lifeSec);
        route.gain.gain.linearRampToValueAtTime(0, t0 + fadeIn + lifeSec + fadeOut);

        const e = {
            name, def,
            patternLen,
            panner: route.panner, gainNode: route.gain, spatial: route.spatial,
            pattern: genTotalPattern(def, patternLen),
            firstTick: system.tick,
            nextTick: system.tick,
            patternCycles: 0,
            dieAt: t0 + fadeIn + lifeSec + fadeOut + 0.2,
            state: 'alive',
            flyTriggered: false
        };
        system.entities.push(e);
        return e;
    }

    function killEntity(e) {
        e.state = 'dead';
        try { e.gainNode.disconnect(); } catch (err) {}
        try { e.panner.disconnect(); } catch (err) {}
        if (e.spatial) e.spatial.alive = false;
    }

    function playEntityNote(e, note, when) {
        const def = e.def;
        const v = totalVoices[def.voice];
        if (!v) return;
        const stepSec = def.step * tickTime;
        const out = e.gainNode;

        if (def.role === 'pad') {
            if (note.chord) {
                const cr = system.chordRoot();
                const oct = def.oct || 0;
                const chord = [cr, cr + 2, cr + 4, cr + 6].slice(0, 3 + Math.floor(Math.random() * 2)).map(d =>
                    sonataDegFreq(root, scale, d) * Math.pow(2, oct)
                );
                v(when, out, chord, (e.patternLen || def.len) * stepSec, def.voiceParams);
            }
        } else if (def.role === 'flyby') {
            if (!e.flyTriggered) {
                const dur = (e.dieAt - ctx.currentTime) * 0.85;
                v(when, out, dur);
                e.flyTriggered = true;
            }
        } else if (def.role === 'perc') {
            v(when, out, note.vel);
        } else {
            const oct = def.oct || 0;
            const freq = sonataDegFreq(root, scale, note.deg) * Math.pow(2, oct);
            const dur = stepSec * (TOTAL_ROLE_DUR[def.role] || 1);
            v(when, out, freq, dur, note.vel, def.voiceParams);
        }
    }

    // ----- Scheduler (lookahead 0.15s) -----
    const schedulerInterval = setInterval(() => {
        if (!isPlaying) return;
        const lookaheadEnd = ctx.currentTime + 0.15;
        while (system.nextTickTime < lookaheadEnd) {
            const tick = system.tick;
            const when = system.nextTickTime;

            // Advance chord progression every bar
            if (tick % ticksPerBar === 0) {
                progBar = Math.floor(tick / ticksPerBar);
                if (progBar > 0 && progBar % 16 === 0 && Math.random() < 0.5) {
                    prog = progSeqs[Math.floor(Math.random() * progSeqs.length)];
                }
            }

            // Process each living entity
            for (let i = system.entities.length - 1; i >= 0; i--) {
                const e = system.entities[i];
                if (e.state === 'dead') { system.entities.splice(i, 1); continue; }

                // Conductor: ban — fade out fast and despawn
                if (bannedEntities.has(e.name) && !e._banning) {
                    e._banning = true;
                    e._wasPinned = false;
                    try {
                        e.gainNode.gain.cancelScheduledValues(ctx.currentTime);
                        e.gainNode.gain.setValueAtTime(e.gainNode.gain.value, ctx.currentTime);
                        e.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
                    } catch (err) {}
                    e.dieAt = ctx.currentTime + 1.1;
                }
                // Conductor: pin — keep alive, hold gain at peak
                if (pinnedEntities.has(e.name) && !e._banning) {
                    if (!e._wasPinned) {
                        try {
                            e.gainNode.gain.cancelScheduledValues(ctx.currentTime);
                            e.gainNode.gain.setValueAtTime(e.gainNode.gain.value, ctx.currentTime);
                            e.gainNode.gain.linearRampToValueAtTime(e.def.gain, ctx.currentTime + 0.5);
                        } catch (err) {}
                        e._wasPinned = true;
                    }
                    e.dieAt = ctx.currentTime + 9999; // never expire while pinned
                } else if (e._wasPinned && !pinnedEntities.has(e.name) && !e._banning) {
                    // Just unpinned — schedule a graceful fade-out
                    try {
                        e.gainNode.gain.cancelScheduledValues(ctx.currentTime);
                        e.gainNode.gain.setValueAtTime(e.gainNode.gain.value, ctx.currentTime);
                        e.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);
                    } catch (err) {}
                    e.dieAt = ctx.currentTime + 3.2;
                    e._wasPinned = false;
                }

                if (ctx.currentTime > e.dieAt) {
                    killEntity(e);
                    system.entities.splice(i, 1);
                    continue;
                }
                // Catch up to current global tick
                const pLen = e.patternLen || e.def.len;
                while (e.nextTick <= tick) {
                    const elapsed = e.nextTick - e.firstTick;
                    const localStep = (elapsed / e.def.step) % pLen;
                    if (Number.isInteger(localStep)) {
                        const note = e.pattern[localStep];
                        if (note) {
                            const fireTime = when - (tick - e.nextTick) * tickTime;
                            playEntityNote(e, note, fireTime);
                        }
                        // End of pattern cycle?
                        if (localStep === 0 && elapsed > 0) {
                            e.patternCycles++;
                            // Regenerate pattern occasionally (every 1-3 cycles since cycles are now 4 bars)
                            if (e.patternCycles % (1 + Math.floor(Math.random() * 3)) === 0) {
                                e.pattern = genTotalPattern(e.def, pLen);
                            }
                        }
                    }
                    e.nextTick += e.def.step;
                }
            }

            system.tick++;
            system.nextTickTime += tickTime;
        }
    }, 25);

    // ----- Spawner: maintain target population -----
    function pickSpawnName() {
        const all = Object.keys(TOTAL_ENTITIES).filter(n => !bannedEntities.has(n));
        if (all.length === 0) return null;
        const active = new Set(system.entities.map(e => e.name));
        const fresh = all.filter(n => !active.has(n));
        const pool = fresh.length > 0 ? fresh : all;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    const spawnerInterval = setInterval(() => {
        if (!isPlaying) return;
        const target = Math.max(1, Math.min(14, params.entityCount || 5));
        // Pinned entities count toward population but spawner should still ensure variety
        const aliveCount = system.entities.length;
        if (aliveCount < target) {
            const name = pickSpawnName();
            if (name) spawnEntity(name);
        }
    }, 1500);

    // Initial population — stagger entries
    const initialCount = Math.max(1, Math.min(14, params.entityCount || 5));
    for (let i = 0; i < initialCount; i++) {
        setTimeout(() => {
            if (!isPlaying) return;
            const name = pickSpawnName();
            if (name) spawnEntity(name);
        }, i * 800 + Math.random() * 400);
    }

    layer.intervals.push(schedulerInterval, spawnerInterval);
    layer.gains.push(mainGain);
    // Stash a kill-all hook so stopLayer cleans up entity nodes
    layer._teardown = () => system.entities.forEach(killEntity);
    // Expose conductor hooks
    layer._spawn = (name) => {
        if (!isPlaying) return false;
        if (!TOTAL_ENTITIES[name]) return false;
        spawnEntity(name);
        return true;
    };
    layer._countActive = (name) => system.entities.filter(e => e.name === name).length;
    return layer;
}

// ========== URBAN SYSTEM ==========

function playHonk(output, vehicleType) {
    if (!ctx || !isPlaying) return;
    const now = ctx.currentTime + Math.random() * 0.3;
    if (vehicleType === 'truck') {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 150;
        const osc2 = ctx.createOscillator(); osc2.type = 'sawtooth'; osc2.frequency.value = 180;
        const dur = 0.5 + Math.random() * 0.5;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(0.15, now + 0.05);
        env.gain.setValueAtTime(0.15, now + dur - 0.05); env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(f); osc2.connect(f); f.connect(env); env.connect(output);
        osc.start(now); osc2.start(now); osc.stop(now + dur); osc2.stop(now + dur);
    } else {
        const freq = 350 + Math.random() * 200;
        const dur = 0.1 + Math.random() * 0.25;
        const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = freq;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq * 1.5; f.Q.value = 2;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(0.1, now + 0.02);
        env.gain.setValueAtTime(0.1, now + dur - 0.02); env.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(f); f.connect(env); env.connect(output);
        osc.start(now); osc.stop(now + dur);
        if (Math.random() < 0.4) {
            const t2 = now + dur + 0.1 + Math.random() * 0.1;
            const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = freq;
            const env2 = ctx.createGain();
            env2.gain.setValueAtTime(0, t2); env2.gain.linearRampToValueAtTime(0.1, t2 + 0.02);
            env2.gain.setValueAtTime(0.1, t2 + dur * 0.5 - 0.02); env2.gain.linearRampToValueAtTime(0, t2 + dur * 0.5);
            osc2.connect(f); env2.connect(output); osc2.connect(env2);
            osc2.start(t2); osc2.stop(t2 + dur * 0.5);
        }
    }
}

function updateUrbanVehicles(dt) {
    if (!isPlaying || urbanVehicles.length === 0 || !ctx) return;
    for (let i = urbanVehicles.length - 1; i >= 0; i--) {
        const v = urbanVehicles[i];
        if (!v.alive) { urbanVehicles.splice(i, 1); continue; }
        v.t += dt;
        if (v.t > v.maxLife) {
            if (v.engineGain) {
                v.engineGain.gain.cancelScheduledValues(ctx.currentTime);
                v.engineGain.gain.setValueAtTime(v.engineGain.gain.value, ctx.currentTime);
                v.engineGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
            }
            setTimeout(() => { try { v.osc.stop(); v.n.stop(); v.panner.disconnect(); } catch(e){} }, 1100);
            v.alive = false; urbanVehicles.splice(i, 1); continue;
        }
        v.pos += dt * v.speed * 0.15;
        const laneR = 8 + Math.abs(v.laneOffset);
        const x = Math.cos(v.pos) * laneR;
        const z = Math.sin(v.pos) * laneR;
        setPannerPos(v.panner, x, 0, z);
        if (v.panner._distFilter) {
            const dist = Math.sqrt(x * x + z * z);
            const t2 = Math.min(dist / 15, 1);
            v.panner._distFilter.frequency.value = 800 + Math.pow(1 - t2, 2) * 19200;
        }
        v.panner._x = x; v.panner._z = z;
        const dist = Math.sqrt(x * x + z * z);
        v.honkTimer += dt;
        if (dist < 5 && v.honkTimer > v.honkCooldown) {
            v.honkTimer = 0;
            v.honkCooldown = 8 + Math.random() * 15;
            playHonk(v.mainGain, v.type);
        }
    }
}

function createUrbanSystem(r) {
    const layer = { nodes: [], gains: [], intervals: [] };
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.7;
    mainGain.connect(masterGain);
    layer.mainGain = mainGain;

    urbanVehicles = [];

    // Background city hum
    const humBuf = createNoiseBuffer('brown', 8);
    const humSrc = ctx.createBufferSource(); humSrc.buffer = humBuf; humSrc.loop = true;
    const humF = ctx.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 300;
    const humG = ctx.createGain(); humG.gain.value = 0.25;
    humSrc.connect(humF); humF.connect(humG); humG.connect(mainGain);
    humSrc.start(); layer.nodes.push(humSrc);

    // 60Hz electrical hum
    [60, 120, 180].forEach((f, i) => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
        const g = ctx.createGain(); g.gain.value = 0.04 / (i + 1);
        osc.connect(g); g.connect(mainGain); osc.start(); layer.nodes.push(osc);
    });

    function spawnVehicle() {
        if (!isPlaying || urbanVehicles.length >= 7) return;
        const types = ['car','car','car','van','truck','metro','audiophile'];
        const type = types[Math.floor(Math.random() * types.length)];
        const laneOffset = (2 + Math.random() * 3) * (Math.random() > 0.5 ? 1 : -1);
        const speed = type === 'metro' ? 14 : (3 + Math.random() * 7);
        const startAngle = Math.random() * Math.PI * 2;
        const engineFreq = type === 'truck' ? 60 : (type === 'metro' ? 100 : (80 + Math.random() * 60));

        const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = engineFreq;
        const n = ctx.createBufferSource(); n.buffer = createNoiseBuffer('brown', 8); n.loop = true;
        const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = type === 'audiophile' ? 180 : 100;
        const engineGain = ctx.createGain(); engineGain.gain.value = 0.12;

        const laneR = 8 + Math.abs(laneOffset);
        const panner = createHRTF(Math.cos(startAngle) * laneR, 0, Math.sin(startAngle) * laneR);
        if (panner._distFilter) { engineGain.connect(panner._distFilter); panner._distFilter.connect(panner); }
        else { engineGain.connect(panner); }
        panner.connect(mainGain);
        osc.connect(engineGain); n.connect(nf); nf.connect(engineGain);
        osc.start(); n.start();
        layer.nodes.push(osc, n);

        // Audiophile: muffled bass leak from car stereo
        if (type === 'audiophile' && r) {
            const musicOsc = ctx.createOscillator(); musicOsc.type = 'square';
            musicOsc.frequency.value = r.baseFreq * 0.5;
            const mf = ctx.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 180; mf.Q.value = 3;
            const mg = ctx.createGain(); mg.gain.value = 0.07;
            musicOsc.connect(mf); mf.connect(mg); mg.connect(panner);
            musicOsc.start(); layer.nodes.push(musicOsc);
        }

        urbanVehicles.push({
            type, panner, osc, n, engineGain, mainGain,
            pos: startAngle, laneOffset, speed,
            t: 0, honkCooldown: 8 + Math.random() * 12, honkTimer: 0,
            alive: true, maxLife: 20 + Math.random() * 20
        });
    }

    for (let i = 0; i < 3; i++) setTimeout(() => { if (isPlaying) spawnVehicle(); }, i * 700);

    function spawnPasserby(name, motion, lifeSec, gainVal, radius) {
        const r = radius || 12;
        const p = createHRTF(
            (Math.random() - 0.5) * r * 2,
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * r * 2
        );
        const ss = createSpatialSource(p, motion || 'passby', lifeSec || 6);
        const g = ctx.createGain(); g.gain.value = gainVal != null ? gainVal : 0.8;
        g.connect(p); p.connect(mainGain);
        spawnProp3D(name, g);
    }

    const spawnInterval = setInterval(() => {
        if (!isPlaying) return;
        if (urbanVehicles.length < 5 && Math.random() < 0.6) spawnVehicle();
        // Occasional pedestrian siren
        if (Math.random() < 0.08) spawnPasserby('siren', 'passby', 6, 0.8);
        // Audiophile car drives by with bass — louder, slower passby
        if (Math.random() < 0.06) spawnPasserby('audiophile', 'approach', 10, 1.0, 14);
        // Talker walking by
        if (Math.random() < 0.10) spawnPasserby('talker', 'wander', 5, 0.7, 8);
        // Walker (footsteps)
        if (Math.random() < 0.12) spawnPasserby('walker', 'wander', 6, 0.55, 8);
        // Melodic walker — humming scale fragments
        if (Math.random() < 0.10) spawnPasserby('urban_arp', 'wander', 5, 0.6, 8);
    }, 2500);

    layer.intervals.push(spawnInterval);
    layer.gains.push(mainGain);
    return layer;
}

// ========== LAYER MANAGEMENT ==========

function stopLayer(layer) {
    if (!layer) return;
    if (layer._teardown) { try { layer._teardown(); } catch (e) {} }
    (layer.nodes || []).forEach(n => { try { n.stop(); n.disconnect(); } catch (e) {} });
    (layer.gains || []).forEach(g => { try { g.disconnect(); } catch (e) {} });
    (layer.intervals || []).forEach(i => clearInterval(i));
    if (layer.mainGain) try { layer.mainGain.disconnect(); } catch (e) {}
}

function applyLayerVolume(layerKey) {
    const layer = activeLayers[layerKey];
    if (layer && layer.mainGain && ctx) {
        const vol = params.layerVolumes[layerKey] !== undefined ? params.layerVolumes[layerKey] : 1.0;
        layer.mainGain.gain.cancelScheduledValues(ctx.currentTime);
        layer.mainGain.gain.setValueAtTime(layer.mainGain.gain.value, ctx.currentTime);
        layer.mainGain.gain.linearRampToValueAtTime(layer._baseVolume * vol, ctx.currentTime + 0.1);
    }
}

function startAllLayers() {
    const r = recipe;
    if (r.layers.wind) activeLayers.wind = createWindLayer(r);
    if (r.layers.drone) activeLayers.drone = createDroneLayer(r);
    if (r.layers.texture) activeLayers.texture = createTextureLayer(r);
    if (r.layers.tone) activeLayers.tone = createToneLayer(r);
    if (r.layers.props) activeLayers.props = createPropsLayer(r);
    if (r.layers.arpeggio) activeLayers.arpeggio = createArpeggioLayer(r);
    if (r.layers.rhythm) activeLayers.rhythm = createRhythmLayer(r);
    if (r.layers.pad) activeLayers.pad = createPadLayer(r);
    if (r.layers.highway) activeLayers.highway = createHighwayLayer(r);
    if (r.layers.melodicArp) activeLayers.melodicArp = createMelodicArpLayer(r);
    if (r.layers.chordal) activeLayers.chordal = createChordalLayer(r);
    if (r.layers.polyrhythm) activeLayers.polyrhythm = createPolyrhythmLayer(r);

    // Special systems
    if (r.specialSystem === 'trance') activeLayers.trance = createTranceSystem(r);
    if (r.specialSystem === 'urban') activeLayers.urban = createUrbanSystem(r);
    if (r.specialSystem === 'lofi') activeLayers.lofi = createLofiSystem(r);
    if (r.specialSystem === 'berlin') activeLayers.berlin = createBerlinSystem(r);
    if (r.specialSystem === 'dub') activeLayers.dub = createDubSystem(r);
    if (r.specialSystem === 'forestSonata') activeLayers.forestSonata = createForestSonataSystem(r);
    if (r.specialSystem === 'tundraSonata') activeLayers.tundraSonata = createTundraSonataSystem(r);
    if (r.specialSystem === 'stormSonata') activeLayers.stormSonata = createStormSonataSystem(r);
    if (r.specialSystem === 'astralSonata') activeLayers.astralSonata = createAstralSonataSystem(r);
    if (r.specialSystem === 'totalSonata') activeLayers.totalSonata = createTotalSonataSystem(r);

    // Apply per-layer volume multipliers
    Object.keys(activeLayers).forEach(k => {
        if (activeLayers[k] && activeLayers[k].mainGain) {
            activeLayers[k]._baseVolume = activeLayers[k].mainGain.gain.value;
            const vol = params.layerVolumes[k] !== undefined ? params.layerVolumes[k] : 1.0;
            activeLayers[k].mainGain.gain.value *= vol;
        }
    });
}

function stopAllLayers() {
    Object.keys(activeLayers).forEach(k => {
        stopLayer(activeLayers[k]);
        activeLayers[k] = null;
    });
    spatialSources = [];
    urbanVehicles = [];
}

// ========== CONTINUOUS EVOLUTION ==========

function startEvolution() {
    if (evolutionTimer) clearInterval(evolutionTimer);

    evolutionTimer = setInterval(() => {
        if (!isPlaying || !recipe) return;

        // Drift filter cutoff
        params.filterCutoff = Math.max(0.2, Math.min(0.95, params.filterCutoff + (Math.random() - 0.5) * 0.12));
        if (masterFilter) {
            masterFilter.frequency.linearRampToValueAtTime(
                200 + params.filterCutoff * 19800, ctx.currentTime + 2
            );
        }

        // Drift brightness and depth
        params.brightness = Math.max(0.15, Math.min(0.85, params.brightness + (Math.random() - 0.5) * 0.1));
        params.depth = Math.max(0.2, Math.min(0.8, params.depth + (Math.random() - 0.5) * 0.08));

        // Spawn extra props from recipe world — keeps things fresh
        if (recipe.props && recipe.props.length > 0 && activeLayers.props && activeLayers.props.mainGain) {
            const extraCount = 1 + Math.floor(Math.random() * 3);
            for (let i = 0; i < extraCount; i++) {
                const prop = recipe.props[Math.floor(Math.random() * recipe.props.length)];
                spawnProp3D(prop, activeLayers.props.mainGain);
            }
        }
    }, 5000 + Math.random() * 8000);
}

// ========== RADAR VISUALIZER ==========

let radarCanvas, radarCtx;

function initRadar() {
    radarCanvas = document.getElementById('radar');
    radarCtx = radarCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 288;
    radarCanvas.width = size * dpr;
    radarCanvas.height = size * dpr;
    radarCtx.scale(dpr, dpr);
    drawRadarIdle();
}

function drawRadarIdle() {
    const c = radarCtx;
    const cx = 144, cy = 144, r = 130;
    c.fillStyle = '#0a0a0a';
    c.fillRect(0, 0, 288, 288);

    // Rings
    c.strokeStyle = '#1a1a1a';
    c.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
        c.beginPath();
        c.arc(cx, cy, r * i / 3, 0, Math.PI * 2);
        c.stroke();
    }

    // Crosshairs
    c.beginPath();
    c.moveTo(cx - r, cy); c.lineTo(cx + r, cy);
    c.moveTo(cx, cy - r); c.lineTo(cx, cy + r);
    c.stroke();

    // Center dot (listener)
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(cx, cy, 3, 0, Math.PI * 2);
    c.fill();

    if (!isPlaying) {
        c.fillStyle = '#333';
        c.font = '12px Fira Mono, monospace';
        c.textAlign = 'center';
        c.fillText('Spatial Radar', cx, cy + 40);
    }
}

function drawRadar() {
    if (!isPlaying) return;
    const c = radarCtx;
    const cx = 144, cy = 144, maxR = 130, scale = maxR / 20;

    // Slower fade trail for more persistence
    c.fillStyle = 'rgba(10, 10, 10, 0.2)';
    c.fillRect(0, 0, 288, 288);

    // Rings
    c.strokeStyle = '#1a1a1a';
    c.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
        c.beginPath();
        c.arc(cx, cy, maxR * i / 3, 0, Math.PI * 2);
        c.stroke();
    }

    // Crosshairs
    c.beginPath();
    c.moveTo(cx - maxR, cy); c.lineTo(cx + maxR, cy);
    c.moveTo(cx, cy - maxR); c.lineTo(cx, cy + maxR);
    c.stroke();

    // Sound sources
    spatialSources.forEach(s => {
        if (!s.alive || s._x === undefined) return;

        // Map 3D to 2D top-down (x, z)
        let sx = cx + s._x * scale;
        let sy = cy + s._z * scale;

        // Clamp to radar bounds
        const dx = sx - cx, dy = sy - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR - 4) {
            sx = cx + (dx / dist) * (maxR - 4);
            sy = cy + (dy / dist) * (maxR - 4);
        }

        // Color based on movement type (including approach/passby)
        const colors = {
            orbit: '#FF00F7', wander: '#00FFFF', flyby: '#FFFF00',
            hover: '#00FF88', spiral: '#FF8800', risefall: '#8888FF',
            approach: '#FF4444', passby: '#44FF44'
        };
        const col = colors[s.type] || '#fff';

        // Size based on height (y)
        const size = Math.max(2, 4 + (s._y || 0) * 0.3);

        // Glow effect — larger, transparent version behind the dot
        c.fillStyle = col;
        c.globalAlpha = 0.15;
        c.beginPath();
        c.arc(sx, sy, size * 3, 0, Math.PI * 2);
        c.fill();

        // Core dot
        c.globalAlpha = 0.85;
        c.beginPath();
        c.arc(sx, sy, size, 0, Math.PI * 2);
        c.fill();

        // Bright center
        c.globalAlpha = 1;
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(sx, sy, size * 0.4, 0, Math.PI * 2);
        c.fill();
    });

    // Center dot (listener) with glow
    c.fillStyle = '#fff';
    c.globalAlpha = 0.15;
    c.beginPath();
    c.arc(cx, cy, 10, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.beginPath();
    c.arc(cx, cy, 3, 0, Math.PI * 2);
    c.fill();
}

// ========== ANIMATION LOOP ==========

let lastTime = 0;

function animationLoop(timestamp) {
    if (!isPlaying) return;
    animFrameId = requestAnimationFrame(animationLoop);

    const dt = lastTime ? (timestamp - lastTime) / 1000 : 0.016;
    lastTime = timestamp;

    updateSpatialSources(Math.min(dt, 0.1));
    updateUrbanVehicles(Math.min(dt, 0.1));
    drawRadar();
}

// ========== PLAY / STOP / REGENERATE ==========

function togglePlay() {
    if (isPlaying) {
        stopAll();
    } else {
        startAll();
    }
}

let fadeOutTimer = null;

function startAll() {
    if (fadeOutTimer) { clearTimeout(fadeOutTimer); fadeOutTimer = null; }
    initAudio();
    if (ctx.state === 'suspended') ctx.resume();

    if (!recipe) recipe = generateRecipe();

    // Randomize delay time per recipe
    if (delayNode) delayNode.delayTime.value = 0.3 + Math.random() * 0.5;

    createReverbImpulse(recipe.reverbDecay);

    isPlaying = true;
    lastTime = 0;
    startAllLayers();
    startEvolution();
    updateBlendDescription();
    displaySpecimenName();

    // Smooth fade in
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(params.volume, ctx.currentTime + 0.5);

    animFrameId = requestAnimationFrame(animationLoop);
    scheduleAutoSwitch();

    document.getElementById('playBtn').textContent = 'Pause';
    document.getElementById('stopBtn').disabled = false;
}

function stopAll() {
    if (autoSwitchTimeout) { clearTimeout(autoSwitchTimeout); autoSwitchTimeout = null; }
    if (!ctx || !masterGain) {
        isPlaying = false;
        document.getElementById('playBtn').textContent = 'Play';
        document.getElementById('stopBtn').disabled = true;
        return;
    }

    // Smooth fade out, then stop nodes
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

    // Mark as not playing immediately to stop spawning
    isPlaying = false;

    // Actually disconnect nodes after fade completes
    fadeOutTimer = setTimeout(() => {
        stopAllLayers();
        if (evolutionTimer) { clearInterval(evolutionTimer); evolutionTimer = null; }
        if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        fadeOutTimer = null;
        setTimeout(drawRadarIdle, 50);
    }, 350);

    document.getElementById('playBtn').textContent = 'Play';
    document.getElementById('stopBtn').disabled = true;
}

function regenerate() {
    if (evolveTransition && isPlaying && ctx) {
        regenerateEvolved();
        return;
    }

    const wasPlaying = isPlaying;
    if (fadeOutTimer) { clearTimeout(fadeOutTimer); fadeOutTimer = null; }

    if (wasPlaying && masterGain && ctx) {
        // Crossfade: fade old down
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    }

    // Schedule the swap after old fades out
    const doRegenerate = () => {
        if (wasPlaying) {
            stopAllLayers();
            spatialSources = [];
        }

        // Clear noise cache to get fresh buffers
        Object.keys(noiseCache).forEach(k => delete noiseCache[k]);

        recipe = generateRecipe();
        updateBlendDescription();
        displaySpecimenName();

        // Randomize delay time for new recipe
        if (delayNode) delayNode.delayTime.value = 0.3 + Math.random() * 0.5;

        if (wasPlaying) {
            createReverbImpulse(recipe.reverbDecay);
            isPlaying = true;
            lastTime = 0;
            startAllLayers();
            startEvolution();
            scheduleAutoSwitch();

            // Fade new soundscape in
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(0, ctx.currentTime);
            masterGain.gain.linearRampToValueAtTime(params.volume, ctx.currentTime + 0.5);

            if (!animFrameId) animFrameId = requestAnimationFrame(animationLoop);
        }
    };

    if (wasPlaying) {
        setTimeout(doRegenerate, 350);
    } else {
        doRegenerate();
    }
}

// ========== UI CONTROLS ==========

function setSliderValueText(id, text) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('aria-valuetext', text);
}

function updateVolume(v) {
    params.volume = v / 100;
    document.getElementById('volumeValue').textContent = v + '%';
    setSliderValueText('masterVolume', v + ' percent');
    if (masterGain && ctx && isPlaying) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(params.volume, ctx.currentTime + 0.1);
    }
}

function updateDensity(v) {
    params.density = v / 100;
    document.getElementById('densityValue').textContent = v + '%';
    setSliderValueText('density', v + ' percent');
}

function updateMovement(v) {
    params.movement = v / 100;
    document.getElementById('movementValue').textContent = v + '%';
    setSliderValueText('movement', v + ' percent');
}

function updateReverb(v) {
    params.reverb = v / 100;
    document.getElementById('reverbValue').textContent = v + '%';
    setSliderValueText('reverb', v + ' percent');
    if (dryGain && wetGain && ctx) {
        dryGain.gain.linearRampToValueAtTime(1 - params.reverb * 0.6, ctx.currentTime + 0.1);
        wetGain.gain.linearRampToValueAtTime(params.reverb * 0.6, ctx.currentTime + 0.1);
        if (delayWet) delayWet.gain.linearRampToValueAtTime(0.08 + params.reverb * 0.15, ctx.currentTime + 0.1);
    }
}

// ========== AUTO-SWITCH TIMER ==========

function logSliderToSeconds(v) {
    if (v <= 0) return 0;
    return Math.round(10 * Math.pow(360, v / 100));
}

function formatTime(seconds) {
    if (seconds <= 0) return 'Off';
    if (seconds < 60) return seconds + 's';
    if (seconds < 3600) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return s > 0 ? m + 'm ' + s + 's' : m + 'm';
    }
    return '1h';
}

function updateAutoSwitch(v) {
    autoSwitchSeconds = logSliderToSeconds(parseInt(v));
    const formatted = formatTime(autoSwitchSeconds);
    document.getElementById('autoSwitchValue').textContent = formatted;
    setSliderValueText('autoSwitch', autoSwitchSeconds === 0 ? 'off' : formatted);
    scheduleAutoSwitch();
}

function updateEntityCount(v) {
    params.entityCount = parseInt(v);
    document.getElementById('entityCountValue').textContent = v;
    setSliderValueText('entityCount', v + ' entities');
}

function updateFlyRate(v) {
    params.flyRate = v / 100;
    document.getElementById('flyRateValue').textContent = v + '%';
    setSliderValueText('flyRate', v + ' percent');
}

function scheduleAutoSwitch() {
    if (autoSwitchTimeout) { clearTimeout(autoSwitchTimeout); autoSwitchTimeout = null; }
    if (autoSwitchSeconds <= 0 || !isPlaying) return;

    autoSwitchTimeout = setTimeout(() => {
        if (isPlaying) {
            regenerate();
            scheduleAutoSwitch();
        }
    }, autoSwitchSeconds * 1000);
}

// ========== EVOLVE CROSSFADE ==========

function regenerateEvolved() {
    const oldLayers = {};
    Object.keys(activeLayers).forEach(k => { oldLayers[k] = activeLayers[k]; });
    const oldParams = {
        brightness: params.brightness,
        depth: params.depth,
        filterCutoff: params.filterCutoff
    };

    // Generate new recipe (this also randomizes params.brightness, etc.)
    Object.keys(noiseCache).forEach(k => delete noiseCache[k]);
    recipe = generateRecipe();
    updateBlendDescription();
    displaySpecimenName();

    const crossfadeDuration = 4;
    const now = ctx.currentTime;

    // Store new param targets before restoring old for interpolation
    const newBrightness = params.brightness;
    const newDepth = params.depth;
    const newFilterCutoff = params.filterCutoff;
    params.brightness = oldParams.brightness;
    params.depth = oldParams.depth;
    params.filterCutoff = oldParams.filterCutoff;

    // Fade out old layers
    Object.keys(oldLayers).forEach(k => {
        const layer = oldLayers[k];
        if (layer && layer.mainGain) {
            layer.mainGain.gain.cancelScheduledValues(now);
            layer.mainGain.gain.setValueAtTime(layer.mainGain.gain.value, now);
            layer.mainGain.gain.linearRampToValueAtTime(0, now + crossfadeDuration);
        }
    });

    // Cleanup old layers after fade
    setTimeout(() => {
        Object.keys(oldLayers).forEach(k => {
            stopLayer(oldLayers[k]);
        });
    }, (crossfadeDuration + 0.5) * 1000);

    // Reset activeLayers for new ones
    Object.keys(activeLayers).forEach(k => { activeLayers[k] = null; });

    // Start new layers
    startAllLayers();

    // Set new layers to 0 and fade in
    Object.keys(activeLayers).forEach(k => {
        const layer = activeLayers[k];
        if (layer && layer.mainGain) {
            const targetVol = layer.mainGain.gain.value;
            layer._baseVolume = targetVol / (params.layerVolumes[k] !== undefined ? params.layerVolumes[k] : 1.0);
            layer.mainGain.gain.setValueAtTime(0, now);
            layer.mainGain.gain.linearRampToValueAtTime(targetVol, now + crossfadeDuration);
        }
    });

    // Interpolate params gradually
    const interpSteps = 20;
    const interpInterval = (crossfadeDuration * 1000) / interpSteps;
    let step = 0;
    const interpTimer = setInterval(() => {
        step++;
        const t = step / interpSteps;
        params.brightness = oldParams.brightness + (newBrightness - oldParams.brightness) * t;
        params.depth = oldParams.depth + (newDepth - oldParams.depth) * t;
        params.filterCutoff = oldParams.filterCutoff + (newFilterCutoff - oldParams.filterCutoff) * t;

        if (masterFilter && ctx) {
            masterFilter.frequency.cancelScheduledValues(ctx.currentTime);
            masterFilter.frequency.linearRampToValueAtTime(
                200 + params.filterCutoff * 19800, ctx.currentTime + 0.2
            );
        }

        if (step >= interpSteps) clearInterval(interpTimer);
    }, interpInterval);

    if (delayNode) delayNode.delayTime.value = 0.3 + Math.random() * 0.5;
    createReverbImpulse(recipe.reverbDecay);
    startEvolution();
    scheduleAutoSwitch();
}

// ========== LAYER VOLUME UI ==========

const layerVolumeLabels = {
    wind: 'Wind', drone: 'Drone', texture: 'Texture', tone: 'Tone',
    arpeggio: 'Arpeggio', rhythm: 'Rhythm', props: 'Props',
    pad: 'Pad', highway: 'Highway', melodicArp: 'Melodic Arp', chordal: 'Chordal',
    polyrhythm: 'Polyrhythm', trance: 'Trance', urban: 'Urban',
    lofi: 'Lo-Fi', berlin: 'Berlin School', dub: 'Dub',
    astralSonata: 'Astral Sonata', forestSonata: 'Forest Sonata',
    stormSonata: 'Storm Sonata', totalSonata: 'Total Sonata',
    tundraSonata: 'Tundra Sonata'
};

function initLayerVolumeSliders() {
    const grid = document.getElementById('layerVolumesGrid');
    if (!grid) return;
    Object.keys(layerVolumeLabels).forEach(key => {
        const group = document.createElement('div');
        group.className = 'slider-group';
        const label = layerVolumeLabels[key];
        group.innerHTML =
            '<label for="layerVol_' + key + '" class="slider-label">' +
                '<span>' + label + '</span>' +
                '<span id="layerVol_' + key + '_val" aria-hidden="true">100%</span>' +
            '</label>' +
            '<input type="range" id="layerVol_' + key + '" min="0" max="100" value="100" ' +
                'aria-valuetext="100 percent" ' +
                'oninput="updateLayerVolume(\'' + key + '\', this.value)">';
        grid.appendChild(group);
    });
}

function toggleLayerVolumes() {
    const grid = document.getElementById('layerVolumesGrid');
    const toggle = document.getElementById('layerVolumesToggle');
    const isOpen = grid.classList.toggle('visible');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function updateLayerVolume(key, v) {
    params.layerVolumes[key] = v / 100;
    document.getElementById('layerVol_' + key + '_val').textContent = v + '%';
    setSliderValueText('layerVol_' + key, v + ' percent');
    applyLayerVolume(key);
}

// ========== AUDITION PANEL ==========

let auditionCtx = null;
let isAuditioning = false;

function ensureAuditionCtx() {
    if (!auditionCtx || auditionCtx.state === 'closed') {
        auditionCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (auditionCtx.state === 'suspended') auditionCtx.resume();
    return auditionCtx;
}

function onWorldChange(v) {
    selectedWorld = v;
    const sec = document.getElementById('auditionEntitiesSection');
    if (sec) sec.style.display = (v === 'totalSonata') ? '' : 'none';
}

function auditionTotalEntity(name) {
    const def = TOTAL_ENTITIES[name];
    if (!def) return;
    const ac = ensureAuditionCtx();
    if (!recipe) recipe = generateRecipe();

    const realCtx = ctx;
    ctx = ac;

    const out = ac.createGain();
    out.gain.value = 0.7;
    out.connect(ac.destination);

    const v = totalVoices[def.voice];
    if (!v) {
        ctx = realCtx;
        return;
    }

    const scale = recipe.toneScale || [0, 2, 4, 7, 9, 11];
    const root = recipe.baseFreq;
    const oct = def.oct || 0;
    const t0 = ac.currentTime + 0.05;
    let totalDur = 1.0;

    if (def.role === 'pad') {
        const chord = [0, 2, 4].map(d => sonataDegFreq(root, scale, d) * Math.pow(2, oct));
        v(t0, out, chord, 3.0, def.voiceParams);
        totalDur = 3.5;
    } else if (def.role === 'flyby') {
        v(t0, out, 2.5);
        totalDur = 3.0;
    } else if (def.role === 'perc') {
        v(t0, out, 0.85);
        v(t0 + 0.45, out, 0.7);
        v(t0 + 0.9, out, 0.7);
        v(t0 + 1.35, out, 0.8);
        totalDur = 2.0;
    } else {
        const range = def.range || [0, 7];
        // Scale audition pacing to def.step so slow voices (talker, owl) breathe properly
        const stepDur = Math.max(0.25, Math.min(1.2, (def.step || 4) * 0.12));
        const noteDur = stepDur * (TOTAL_ROLE_DUR[def.role] || 1);
        const span = range[1] - range[0];
        for (let i = 0; i < 4; i++) {
            const deg = range[0] + Math.floor(Math.random() * (span + 1));
            const freq = sonataDegFreq(root, scale, deg) * Math.pow(2, oct);
            v(t0 + i * stepDur, out, freq, noteDur, 0.75, def.voiceParams);
        }
        totalDur = stepDur * 4 + noteDur + 0.2;
    }

    ctx = realCtx;
    setTimeout(() => {
        try { out.disconnect(); } catch (e) {}
    }, Math.max(1500, totalDur * 1000 + 300));
}

function auditionProp(name) {
    const ac = ensureAuditionCtx();
    if (!recipe) recipe = generateRecipe();

    const realCtx = ctx;
    ctx = ac;

    const out = ac.createGain();
    out.gain.value = 0.8;
    out.connect(ac.destination);

    const gen = propGenerators[name];
    if (gen) gen(ac, out, 1.0);

    ctx = realCtx;
}

function auditionLayer(layerKey) {
    if (isAuditioning) return; // prevent overlap
    const ac = ensureAuditionCtx();
    if (!recipe) recipe = generateRecipe();

    // Save real state
    const realCtx = ctx;
    const realMasterGain = masterGain;
    const realIsPlaying = isPlaying;

    // Swap to audition context — keep swapped for full duration
    // so interval-based layers (tone, arp, pad, etc.) can fire
    ctx = ac;
    const tempGain = ac.createGain();
    tempGain.gain.value = 0.6;
    tempGain.connect(ac.destination);
    masterGain = tempGain;
    isPlaying = true;
    isAuditioning = true;

    const creators = {
        wind: createWindLayer, drone: createDroneLayer, texture: createTextureLayer,
        tone: createToneLayer, arpeggio: createArpeggioLayer, rhythm: createRhythmLayer,
        pad: createPadLayer, highway: createHighwayLayer,
        melodicArp: createMelodicArpLayer, chordal: createChordalLayer,
        polyrhythm: createPolyrhythmLayer,
        trance: createTranceSystem, urban: createUrbanSystem,
        lofi: createLofiSystem, berlin: createBerlinSystem, dub: createDubSystem,
        astralSonata: createAstralSonataSystem,
        forestSonata: createForestSonataSystem, tundraSonata: createTundraSonataSystem,
        stormSonata: createStormSonataSystem, totalSonata: createTotalSonataSystem
    };

    const creator = creators[layerKey];
    if (creator) {
        const layer = creator(recipe);
        // Let it play for 4 seconds with ctx still swapped, then cleanup
        setTimeout(() => {
            // Fade out
            if (layer.mainGain) {
                layer.mainGain.gain.cancelScheduledValues(ac.currentTime);
                layer.mainGain.gain.setValueAtTime(layer.mainGain.gain.value, ac.currentTime);
                layer.mainGain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5);
            }
            setTimeout(() => {
                stopLayer(layer);
                // Restore real state
                ctx = realCtx;
                masterGain = realMasterGain;
                isPlaying = realIsPlaying;
                isAuditioning = false;
            }, 600);
        }, 4000);
    } else {
        ctx = realCtx;
        masterGain = realMasterGain;
        isPlaying = realIsPlaying;
        isAuditioning = false;
    }
}

function initAuditionPanel() {
    const propsGrid = document.getElementById('auditionPropsGrid');
    const layersGrid = document.getElementById('auditionLayersGrid');
    if (!propsGrid || !layersGrid) return;

    // Prop buttons
    const propNames = Object.keys(propGenerators);
    propNames.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'audition-btn';
        btn.textContent = name.replace(/_/g, ' ');
        btn.onclick = () => auditionProp(name);
        propsGrid.appendChild(btn);
    });

    // Layer buttons
    const layerNames = {
        wind: 'Wind', drone: 'Drone', texture: 'Texture', tone: 'Tone',
        arpeggio: 'Arpeggio', rhythm: 'Rhythm',
        pad: 'Pad', highway: 'Highway', melodicArp: 'Melodic Arp', chordal: 'Chordal',
        polyrhythm: 'Polyrhythm', trance: 'Trance', urban: 'Urban',
    lofi: 'Lo-Fi', berlin: 'Berlin School', dub: 'Dub',
    astralSonata: 'Astral Sonata', forestSonata: 'Forest Sonata',
    stormSonata: 'Storm Sonata', totalSonata: 'Total Sonata',
    tundraSonata: 'Tundra Sonata'
    };
    Object.keys(layerNames).forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'audition-btn audition-layer';
        btn.textContent = layerNames[key];
        btn.onclick = () => auditionLayer(key);
        layersGrid.appendChild(btn);
    });

    // Total Sonata entity buttons (visible only when Total Sonata is selected)
    const entitiesGrid = document.getElementById('auditionEntitiesGrid');
    if (entitiesGrid && typeof TOTAL_ENTITIES !== 'undefined') {
        Object.keys(TOTAL_ENTITIES).sort().forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'audition-btn';
            btn.textContent = name.replace(/_/g, ' ');
            btn.onclick = () => auditionTotalEntity(name);
            entitiesGrid.appendChild(btn);
        });
    }
    // Sync visibility with current selection
    const sec = document.getElementById('auditionEntitiesSection');
    if (sec) sec.style.display = (selectedWorld === 'totalSonata') ? '' : 'none';
}

function toggleAudition() {
    const panel = document.getElementById('auditionContent');
    const toggle = document.getElementById('auditionToggle');
    const isOpen = panel.classList.toggle('visible');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

// ========== CONDUCTOR PANEL ==========

let conductorMode = 'spawn'; // 'spawn' | 'pin' | 'ban'

function toggleConductor() {
    const panel = document.getElementById('conductorContent');
    const toggle = document.getElementById('conductorToggle');
    if (!panel) return;
    const isOpen = panel.classList.toggle('visible');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) updateConductorStatus();
}

function initConductorPanel() {
    const grid = document.getElementById('conductorGrid');
    if (!grid || typeof TOTAL_ENTITIES === 'undefined') return;

    // Group by role
    const roleOrder = ['lead', 'bass', 'pad', 'arp', 'perc', 'flyby'];
    const roleLabels = {
        lead: 'Lead', bass: 'Bass', pad: 'Pad', arp: 'Arp',
        perc: 'Percussion', flyby: 'Flyby'
    };
    const byRole = {};
    Object.keys(TOTAL_ENTITIES).forEach(name => {
        const role = TOTAL_ENTITIES[name].role;
        (byRole[role] = byRole[role] || []).push(name);
    });

    grid.innerHTML = '';
    roleOrder.forEach(role => {
        if (!byRole[role]) return;
        const h = document.createElement('h3');
        h.textContent = roleLabels[role] || role;
        grid.appendChild(h);
        byRole[role].sort().forEach(name => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'entity-btn';
            btn.dataset.name = name;
            btn.innerHTML =
                '<span class="entity-name">' + name.replace(/_/g, ' ') + '</span>' +
                '<span class="count" id="entityCount_' + name + '" aria-hidden="true"></span>';
            btn.setAttribute('aria-label', name.replace(/_/g, ' '));
            btn.onclick = () => conductorClick(name, btn);
            grid.appendChild(btn);
        });
    });

    refreshConductorButtons();
    // Periodically refresh playing-counts so users can see live activity
    setInterval(refreshConductorButtons, 800);
}

function conductorClick(name, btn) {
    if (conductorMode === 'pin') {
        if (pinnedEntities.has(name)) pinnedEntities.delete(name);
        else { pinnedEntities.add(name); bannedEntities.delete(name); }
    } else if (conductorMode === 'ban') {
        if (bannedEntities.has(name)) bannedEntities.delete(name);
        else { bannedEntities.add(name); pinnedEntities.delete(name); }
    } else {
        // Spawn
        const layer = activeLayers.totalSonata;
        if (layer && typeof layer._spawn === 'function') {
            layer._spawn(name);
        }
    }
    refreshConductorButtons();
}

function conductorClearAll() {
    pinnedEntities.clear();
    bannedEntities.clear();
    refreshConductorButtons();
}

function refreshConductorButtons() {
    const layer = activeLayers.totalSonata;
    const grid = document.getElementById('conductorGrid');
    if (!grid) return;
    const buttons = grid.querySelectorAll('.entity-btn');
    buttons.forEach(btn => {
        const name = btn.dataset.name;
        btn.classList.toggle('pinned', pinnedEntities.has(name));
        btn.classList.toggle('banned', bannedEntities.has(name));
        const count = (layer && layer._countActive) ? layer._countActive(name) : 0;
        const countEl = btn.querySelector('.count');
        if (countEl) countEl.textContent = count > 0 ? '× ' + count : '';
        // Aria-pressed reflects the toggle state for the active mode
        if (conductorMode === 'pin') btn.setAttribute('aria-pressed', pinnedEntities.has(name));
        else if (conductorMode === 'ban') btn.setAttribute('aria-pressed', bannedEntities.has(name));
        else btn.removeAttribute('aria-pressed');
    });
    updateConductorStatus();
}

function updateConductorStatus() {
    const el = document.getElementById('conductorStatus');
    if (!el) return;
    const layer = activeLayers.totalSonata;
    const live = layer ? (layer._countActive ? Object.keys(TOTAL_ENTITIES).reduce((s, n) => s + layer._countActive(n), 0) : 0) : 0;
    el.textContent = (layer ? live + ' active · ' : 'Total Sonata not running · ') +
        pinnedEntities.size + ' pinned · ' + bannedEntities.size + ' banned';
}

// ========== KEYBOARD SHORTCUTS ==========

function isFormFieldFocused() {
    const t = document.activeElement;
    if (!t) return false;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
    if (t.isContentEditable) return true;
    return false;
}

function toggleShortcutsHelp() {
    const panel = document.getElementById('shortcutsHelp');
    if (!panel) return;
    const visible = panel.classList.toggle('visible');
    panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) panel.focus();
}

function handleGlobalKeydown(ev) {
    // Always allow Esc to close the help overlay even when nothing is focused
    if (ev.key === 'Escape') {
        const help = document.getElementById('shortcutsHelp');
        if (help && help.classList.contains('visible')) {
            ev.preventDefault();
            toggleShortcutsHelp();
            return;
        }
    }
    if (isFormFieldFocused()) return;

    // Space — play/pause
    if (ev.code === 'Space' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        togglePlay();
        return;
    }
    // R — regenerate
    if ((ev.key === 'r' || ev.key === 'R') && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        regenerate();
        return;
    }
    // Esc — stop (when help is closed)
    if (ev.key === 'Escape') {
        ev.preventDefault();
        stopAll();
        return;
    }
    // ? or / — toggle help
    if (ev.key === '?' || ev.key === '/') {
        ev.preventDefault();
        toggleShortcutsHelp();
        return;
    }
    // L — toggle Layer Volumes
    if ((ev.key === 'l' || ev.key === 'L') && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        toggleLayerVolumes();
        return;
    }
    // C — toggle Conductor panel
    if ((ev.key === 'c' || ev.key === 'C') && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        if (typeof toggleConductor === 'function') toggleConductor();
        return;
    }
}

// ========== INIT ==========

window.addEventListener('load', () => {
    initRadar();
    initLayerVolumeSliders();
    initAuditionPanel();
    initConductorPanel();
    document.addEventListener('keydown', handleGlobalKeydown);
});
