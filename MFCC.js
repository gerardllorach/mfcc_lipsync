//@Calculate MFCC
// Code to extract MFCCs
// TODO: move the mfcc calculation to another file
// TODO: move the GUI to another file

// Globals
if (!LS.Globals)
  LS.Globals = {};

if (!LS.Globals.AContext)
  LS.Globals.AContext = new AudioContext();

var context = LS.Globals.AContext;
this._smoothness = 0.6;
this.fftSize = 512;

// Audio sources
// URLs
//this.URL = [];

// Microphone
navigator.getUserMedia  = navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia;


this.URL = [];


// START
this.onStart = function(){
  // I see five lamps
  this.URL.push("https://webglstudio.org/latest/fileserver/files//gerard/audios/i-have-four-airplanes-f.wav");
  this.URL.push("https://webglstudio.org/latest/fileserver/files//gerard/audios/pm-aeiou.wav");
  // Sound source
  this._sample = context.createBufferSource();
  // Gain Node
  this._gainNode = context.createGain();
  // Analyser
  this._analyser = context.createAnalyser();
  // FFT size
  this._analyser.fftSize = this.fftSize;
  // FFT smoothing
  this._analyser.smoothingTimeConstant = this._smoothness;
  

  // MFCC
  this.MFCC = new MFCC(this._analyser);
  this.MFCC.init();
  LS.Globals.MFCC = this.MFCC;
  
  // Load GMM
  var URLGMMFile = "https://webglstudio.org/latest/fileserver/files//gerard/MFCCs%20lipsync/jnas-mono-16mix-gid.hmmdefs";
  this.gmm = new Model(URLGMMFile);
  LS.Globals.gmm = this.gmm;
  
  // Start mic
  //this.startMicrophone();
  // Load sample
  var url = this.URL[0];
  this.loadSample(url);
}

var once = false;
LS.Globals.baseProb = [];
// UPDATE
this.onUpdate = function(){
  
  // Extract MFCCs
  if (this._audioReady){
    this.MFCC.computeMFCCs();
  
    // Compute GMM
    if (this.gmm.ready){
      if (!once){
        for (var i = 0; i < this.MFCC.mfcc.length; i++)
          this.MFCC.mfcc[i] = this.gmm.model.a[0][0].mean[i];
        this.gmm.compute(this.MFCC.mfcc);
        var keys = Object.keys(this.gmm.phonemeP);
        for (var i = 0; i<keys.length; i++)
          LS.Globals.baseProb[i] = this.gmm.phonemeP[keys[i]];
        
        once = true;
        
      } else
        this.gmm.compute(this.MFCC.mfcc);
    }
  }
  
  node.scene.refresh();
}


this.onFinish = function(){
  
  this.stopSample();
}




this.playSample = function(){

  // Sample to analyser
  this._sample.connect (this._analyser);
  // Analyser to Gain
  this._analyser.connect(this._gainNode);  
  // Gain to Hardware
  this._gainNode.connect(context.destination);
  
  console.log("File Sample Rate:", context.sampleRate, "Hz.");
  
  // Create filter banks
  this.MFCC.fs = context.sampleRate;
  this.MFCC.createFilterBanks();
  this._audioReady = true;
  
  // start
  this._sample.start(0);
  //this._sample.loop = true;
}

this.startMicrophone = function(){
  
  this.stopSample();
  
  that = this;
  navigator.getUserMedia({audio: true}, function(stream) {
    that._stream = stream;
    that._sample = context.createMediaStreamSource(stream);
    that._sample.connect(that._analyser);
    console.log("Mic Sample Rate:", context.sampleRate, "Hz.");
    that._analyser.disconnect();
    that._gainNode.disconnect();
    // Create filter banks
    that.MFCC.fs = context.sampleRate;
    that.MFCC.createFilterBanks();
    that._audioReady = true;
    //this._analyser.connect(this._gainNode);
  //this._gainNode.connect(context.destination);
  }, function(e){console.log("ERROR: get user media: ", e);});
  
}


this.loadSample = function(inURL){
  var URL = LS.RM.getFullURL (inURL);
  var request = new XMLHttpRequest();
  request.open('GET', URL, true);
  request.responseType = 'arraybuffer';
  
  var that = this;
  request.onload = function(){
    context.decodeAudioData(request.response,
      function(buffer){
        that.stopSample();
        that._sample = context.createBufferSource();
        that._sample.buffer = buffer;
        console.log("Audio loaded");
        that.playSample();
      }, function(e){ console.error("Failed to load audio", URL);});
  };
  request.send();
}



this.stopSample = function(){
  // If AudioBufferSourceNode has started
  if(this._sample)
    if(this._sample.buffer){
      this._sample.stop(0);
      this._audioReady = false;
    }
  
  // If microphone input
  if (this._stream){
    this._stream.getTracks()[0].stop();
    console.log(this._stream.getTracks());
    this._audioReady = false;
  }
}




/* Juluius
http://www.sp.nitech.ac.jp/~ri/julius-dev/doxygen/julius/4.1.2/en/mfcc-core_8c.html
https://github.com/julius-speech/julius/blob/908275fc44ff3212ad898f2288457420fdb5c7b8/libsent/include/sent/mfcc.h
 * The default values here are the ones used in the standard acoustic models
 * distributed together with Julius, and some of them have different value from
 * HTK defaults.  So be careful of the default values.

MFCC_E_D_N_Z = MFCC(12) + DELTA_MFCC(12) + DELTA_ENERGY(1) (CMN)                   25-dimension

--- Some definitions:
#define DEF_SMPPERIOD   625 ///< Default sampling period in 100ns (625 = 16kHz)
#define DEF_FRAMESIZE   400 ///< Default Window size in samples, similar to WINDOWSIZE in HTK (unit is different)
#define DEF_FFTNUM      512 ///< Number of FFT steps
#define DEF_FRAMESHIFT  160 ///< Default frame shift length in samples
#define DEF_PREENPH     0.97  ///< Default pre-emphasis coefficient, corresponds to PREEMCOEF in HTK
#define DEF_MFCCDIM     12  ///< Default number of MFCC dimension, corresponds to NUMCEPS in HTK
#define DEF_CEPLIF      22  ///< Default cepstral Liftering coefficient, corresponds to CEPLIFTER in HTK
#define DEF_FBANK       24  ///< Default number of filterbank channels, corresponds to NUMCHANS in HTK
#define DEF_DELWIN      2 ///< Default delta window size, corresponds to DELTAWINDOW in HTK
#define DEF_ACCWIN      2 ///< Default acceleration window size, corresponds to ACCWINDOW in HTK
#define DEF_SILFLOOR    50.0  ///< Default energy silence floor in dBs, corresponds to SILFLOOR in HTK
#define DEF_ESCALE      1.0 ///< Default scaling coefficient of log energy, corresponds to ESCALE in HTK

#define DEF_SSALPHA     2.0 ///< Default alpha coefficient for spectral subtraction
#define DEF_SSFLOOR     0.5 ///< Default flooring coefficient for spectral subtraction


make_default_para(Value *para)
{
  para->basetype   = F_MFCC;
  para->smp_period = 625; // 16kHz = 625 100ns unit 
  para->smp_freq   = 16000; // 16kHz = 625 100ns unit 
  para->framesize  = DEF_FRAMESIZE;
  para->frameshift = DEF_FRAMESHIFT;
  para->preEmph    = DEF_PREENPH;
  para->fbank_num  = DEF_FBANK;
  para->lifter     = DEF_CEPLIF;
  para->delWin     = DEF_DELWIN;
  para->accWin     = DEF_ACCWIN;
  para->raw_e      = FALSE;
  para->enormal    = FALSE;
  para->escale     = DEF_ESCALE;
  para->silFloor   = DEF_SILFLOOR;
  para->cvn    = FALSE;
  para->hipass     = -1;  //disabled 
  para->lopass     = -1;  // disabled 
  //para->ss_alpha    = DEF_SSALPHA;
  //para->ss_floor    = DEF_SSFLOOR;
  para->vtln_alpha = 1.0; // disabled 
  para->zmeanframe = FALSE;
  para->usepower   = FALSE;
  
  // From Trained Data configuration (MFCC_E_D_N_Z)
  para->energy = true
  para->absesup = true
  para->cmn = true
  para->delta = true
  
  // Buf lengs
  para->baselen = para->mfcc_dim + (para->c0 ? 1 : 0) + (para->energy ? 1 : 0)
  para->baselen = 13
  para->vecbuflen = para->baselen * (1 + (para->delta ? 1 : 0) + (para->acc ? 1 : 0))
  para->vecbuflen = 26
  para->veclen = para->vecbuflen - (para->absesup ? 1 : 0);
  para->veclen = 25
  
}

make_default_para_htk(Value *para)
{
  para->framesize  = 256000.0;  // dummy! 
  para->preEmph    = 0.97;
  para->fbank_num  = 20;
  para->lifter     = 22;
  para->delWin     = 2;
  para->accWin     = 2;
  para->raw_e      = TRUE;
  para->enormal    = TRUE;
  para->escale     = 0.1;
  para->silFloor   = 50.0;
  para->hipass     = -1;  // disabled 
  para->lopass     = -1;  // disabled 
  para->vtln_alpha = 1.0; // disabled 
  para->zmeanframe = FALSE;
  para->usepower   = FALSE;
}



// Parameter definition
https://github.com/julius-speech/julius/blob/908275fc44ff3212ad898f2288457420fdb5c7b8/libsent/src/wav2mfcc/para.c
https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libsent/include/sent/mfcc.h

https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libsent/src/anlz/paramtypes.c
*/

/*
ACOUTSIC MODEL
https://raw.githubusercontent.com/julius-speech/dictation-kit/master/model/phone_m/jnas-mono-16mix-gid.hmmdefs
https://github.com/julius-speech/dictation-kit/tree/master/model/phone_m
16 guassians of mfcc parametes (25) for each state (3 states to change to)
*/


/*
Cepstral Mean Normalization (CMN)

// Cepstral mean normalization
// Real time processing uses the previous input to calculate the current CMN
// parameters, thus for the first input utterance CMN cannot be performed.
// when the realtime option is ON the previous 5 second of input is always used.

// CMN is meant for reducing noise and other variables, such as vocal tract. Explained here:
// http://dsp.stackexchange.com/questions/19564/cepstral-mean-normalization
*/

/*
http://www.voxforge.org/home/forums/message-boards/acoustic-model-discussions/mfcc_d_n_z_0-format
http://julius.osdn.jp/book/Julius-3.2-book-e.pdf (page 30)
MFCC_E_D_N_Z
MFCC_E_D_N_Z = MFCC(12)+ DELTA_MFCC(12)+ DELTA_Pow(1) (CMN)                   25-dimension
<VECSIZE> 25<NULLD><MFCC_E_D_N_Z><DIAGC>

para->energy = true
para->absesup = true
para->cmn = true
para->delta = true

_E has energy
_N absolute energy suppressed
_D has delta coe?cients
_A has acceleration coe?cients
_C is compressed
_Z has zero mean static coef.
_K has CRC checksum
_O has 0’th cepstral coef

/// Database that relates qualifier type strings to binary code and description string.
static OptionStr pqual[] = {
    {"_E", F_ENERGY, "log energy coef.", TRUE},
    {"_N", F_ENERGY_SUP, "uppress absolute energy", TRUE},
    {"_D", F_DELTA, "delta coef.", TRUE},
  {"_A", F_ACCL, "acceleration coef.", TRUE},
  {"_C", F_COMPRESS, "compressed", TRUE},
    {"_Z", F_CEPNORM, "cepstral mean normalization", TRUE},
  {"_K", F_CHECKSUM, "CRC checksum added", TRUE},
  {"_0", F_ZEROTH, "0'th cepstral parameter", TRUE},
  {NULL,0,NULL,FALSE}
};


*/