const { JSDOM } = require("jsdom");
const fs = require('fs');
const _ = require("lodash"); // Assuming lodash might be available or we can mock what we need
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, 'hex_map.html'), 'utf8');
const dom = new JSDOM(html);
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock dependencies
global.$ = function () {
    let el = {
        val: () => "0101",
        empty: () => el,
        append: () => el,
        text: () => el,
        html: () => el,
        show: () => el,
        hide: () => el,
        addClass: () => el,
        removeClass: () => el,
        prop: () => el,
        on: () => el,
        accordion: () => el,
        get: () => []
    };
    return el;
}
global.$.ajax = () => { };
global.console.log = () => { }; // Mute standard logs

// Stub missing HTML elements
const stubIds = ['logContent', 'systemLogContent', 'hexInfoBody', 'sysAcc-main-content', 'mgt2e-world-stats'];
stubIds.forEach(id => {
    if (!document.getElementById(id)) {
        let el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

let coreData = fs.readFileSync(path.join(__dirname, 'js/core.js'), 'utf8');
let constantsData = fs.readFileSync(path.join(__dirname, 'js/constants.js'), 'utf8');
let mgt2eData = fs.readFileSync(path.join(__dirname, 'js/mgt2e_engine.js'), 'utf8');

// Basic mock for rng
global.rng = Math.random;

// Eval the files in the context of globals
eval(constantsData);
eval(coreData);
eval(mgt2eData);

// Reroute writeLogLine to capture it
let capturedLogs = [];
global.writeLogLine = function (msg) {
    capturedLogs.push(msg);
};

console.info("--- Testing Standard Atmosphere ---");
let sysBase1 = { hexId: "0101", ageGyr: 4.5, hzco: 2.0, worlds: [] };
let standardW = {
    type: 'Mainworld',
    orbitId: 2.0,
    size: 8,
    atmCode: 6, // Standard Nitrogen-Oxygen
    meanTempK: 288,
    diameterTerra: 1.0,
    mass: 1.0,
    gravity: 1.0
};
sysBase1.worlds.push(standardW);

generateMgT2ESystemChunk4(sysBase1, null);

for (let msg of capturedLogs) {
    if (msg.includes("Composition:") || msg.includes("Oxygen") || msg.includes("Trace")) {
        console.info(msg);
    }
}
console.info(`World Taints: ${standardW.taints}`);

capturedLogs = [];

console.info("\n--- Testing Exotic Atmosphere ---");
let sysBase2 = { hexId: "0102", ageGyr: 4.5, hzco: 2.0, worlds: [] };
let exoticW = {
    type: 'Terrestrial Planet',
    orbitId: 1.0, // Hot
    size: 8,
    atmCode: 10, // Exotic
    meanTempK: 350,
    diameterTerra: 1.0,
    mass: 1.0,
    gravity: 1.0,
    hydroCode: 1, // Has water -> CO should become CO2
    hydroPercent: 10
};
sysBase2.worlds.push(exoticW);

generateMgT2ESystemChunk4(sysBase2, null);

for (let msg of capturedLogs) {
    if (msg.includes("Escape") || msg.includes("Gas Mix") || msg.includes("Retained") || msg.includes("Carbon Monoxide")) {
        console.info(msg);
    }
}
console.info(`Exotic Mix Array: ${JSON.stringify(exoticW.gases)}`);
console.info(`World Taints: ${exoticW.taints}`);
