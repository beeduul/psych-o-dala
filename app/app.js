"use strict";

let GLUtil = require('gl_util');
let Graphics = require('graphics');
let Layer = require('layer');
let Palette = require('palette');

var FPSLimit = 30;

var App = {
  
  last_time: undefined,
  start_time: undefined,
  layers: [],
  
  globalKeyBlockCount: 0,
  
  shaders: {
    // example: {
    //   program: undefined, // created in initShaders
    //   attributes: {
    //     attr_name: {}
    //   },
    //   uniforms: {
    //     uniform_name: { value: value }
    //   }
    // },
    point_painter: {
      name: 'point_painter',
      attributes: {
        aUV: {}
      },
    },
    painter: {
     name: 'painter',
      attributes: {
        aUV: {},
        aVert: {},
      },
    },
    simulator: {
      dataBufferCount: 6,
      name: 'simulator',
      attributes: {
        aPosition: {},
      },
    },
  },

  isInitialized: function() {
    return this.start_time != undefined;
  },

  getPaletteParams: function() {
    var hue = Math.random() * 360;
    return {
      symmetry:         { default: 1,     min: 1,     max: 16    },
      // colorHue:         { default: hue,   min: 0,     max: 360   }, // hue is in degress
      saturation:       { default: 1,     min: 0,     max: 1.0   }, // saturation is 0 .. 1
      colorNoise:       { default: 0.1,   min: 0,     max: 1     },
      spray:            { default: 0,     min: 0,     max: 0.1   }, // percent of screen
      size:             { default: 25.0,  min: 1,     max: 100   },
      age:              { default: 2500,  min: 500,   max: 30000 }, // ms
      pulse:            { default: 0,     min: 0,     max: 2.0   },  // pulses per second
      flow:             { default: 125,   min: 10,    max: 250   },  // particles per second
      accel:            { default: 0,     min: -10,   max: 10    },
      decay:            { default: 0.999, min: 0.95,  max: 1     }
    };
  },

  init: function (updateUICallback) {

    this.updateUICallback = updateUICallback;

    var canvas = this.canvas = document.getElementById("glcanvas");
    Graphics.init(canvas);

    // init shaders
    Graphics.initShaders(GLUtil.gl(), this.shaders);
    
    this.onWindowResize();
    
    this.addLayer();
    this.presets = {
    };

    (function(self) {
      window.addEventListener(
        'resize', function() {self.onWindowResize();}, false
      );

      ['keydown', 'keypress', 'keyup'].forEach(function(eventType) {
        window.addEventListener(eventType, function(event) {
          self.handleKeyEvent(event);
        });
      });

      window.addEventListener('mousewheel', function(event) {
        event.preventDefault();
      });

    })(this);

    this.start_time = Date.now();
    this.last_time = 0;

    this.update();

  },
  
  addLayer() {
    let shaders = this.shaders;
    
    this.activeLayer = new Layer(this.getPaletteParams(), shaders);
    this.layers.push(this.activeLayer);
    this.dirty = true;
  },
  
  selectLayer(layerIndex) {
    this.activeLayer = this.layers[layerIndex];
    this.dirty = true;
  },
  
  onWindowResize: function() {
    this.width = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    // this.camera.aspect = this.width/this.height;
  },
  
  update: function() {

    var nowTime = Date.now() - this.start_time;
    var deltaTime = nowTime - this.last_time;

    if (this.dirty) {
      this.updateUICallback();
      this.dirty = false;
    }

    if (nowTime - this.last_time > 1000 / FPSLimit) {
      var gl = GLUtil.gl();

      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      this.last_time = nowTime;
      let time = { nowTime: nowTime, deltaTime: deltaTime };      
      for (let i = 0; i < this.layers.length; i++) {
        this.layers[i].update(this.canvas, time);
      }
    }

    var fn = this.update.bind(this);
    window.requestAnimationFrame(fn);

  },

  handleMouseEvent: function(event) {
    if (event.type == "mousedown") {
      this.drawing = true;
      this.dirty = true;
    } else if (event.type == "mouseup") {
      this.drawing = false;
      this.dirty = true;
    }
    this.activeLayer.handlePointerEvent(event);
  },

  globalKeyBlock: function() {
    return this.globalKeyBlockCount > 0;
  },

  handleKeyEvent: function(event) {

    if (this.globalKeyBlock()) {
      return;
    }

    switch(event.type) {
    case "keydown":
      switch(event.key) {
      case "r":
        this.activeLayer.setRecording(true);
        break;
      case "f":
        Graphics.toggleFullScreen();
        break;
      }
      break;
    case "keyup":
      switch(event.key) {
      case "r":
        this.activeLayer.setRecording(false);
        break;
      }

    case "keypress":
      break;
    }
  },

  getPaletteParam: function(name) {
    return this.activeLayer.getPaletteParam(name);
  },

  getPaletteValue: function(name) {
    return this.activeLayer.getPaletteValue(name);
  },

  setPaletteValue: function(name, value) {
    this.getPaletteParam(name).value = value;
  },
  
  randomizePalette: function() {
    this.activeLayer.palette = new Palette(this.getPaletteParams(), true);
    this.dirty = true;
  },
  
  getPresetNames: function() {
    return Object.keys(this.presets);
  },
  
  setPreset: function(presetName) {
    if (this.presets[presetName]) {
      this.activeLayer.palette = this.presets[presetName];
      this.dirty = true;
    }
  },
  
  checkPresetName: function(presetName) {
    if (!presetName) {
      return "enter a name for your preset";
    }
    
    if (typeof presetName != 'string') {
      return `weird preset name error (${typeof presetName})`;
    }
    
    if (presetName.length < 3) {
      return 'too short';
    }
    
    if (this.presets[presetName]) {
      return "already exists, choose a unique name";
    }
    
    return null;
  },

  addPreset: function(presetName) {
    this.presets[presetName] = new Palette(this.activeLayer.palette);
    this.dirty = true;
  }

};

module.exports = App;
