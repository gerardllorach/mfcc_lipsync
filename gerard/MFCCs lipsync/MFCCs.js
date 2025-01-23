//@Calculate MFCC
// Code to extract MFCCs


// Globals
if (!LS.Globals)
  LS.Globals = {};

if (!LS.Globals.AContext)
	LS.Globals.AContext = new AudioContext();

LS.Globals.Control = this;

var context = LS.Globals.AContext;
this._smoothness = 0.6;//0.6;




// Microphone
navigator.getUserMedia  = navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia;



this.letter = "a";
this.state = 1;
this["@state"] = { type: LS.TYPES.NUMBER, step: 1, precision: 0 }
this.mfccDim = LS.Globals.mfccDim = 12;


// START
this.onStart = function(){
  // Audio sources
  this.URL = [];
  
  var path = "https://webglstudio.org/latest/fileserver/files//gerard/audios/";
  this.URL.push(path + "i-have-four-airplanes-f.wav");//0
  this.URL.push(path + "pm-aeiou.wav");//1
  this.URL.push(path + "pm-aeiou_16kHz.wav");//2
  this.URL.push(path + "sp10.wav");//3
  this.URL.push(path + "sp10_44100Hz.wav");//4

  this.URL.push(path + "500_700Hz.wav");//5
  this.URL.push(path + "pm-aeiou.wav");//6
  this.URL.push(path + "chirp100_4000.wav");//7
  this.URL.push(path + "150Hz.wav"); //8
  //this.URL.push(path + "500Hz.wav");

  this.URL.push(path + "openjaw.wav");
  this.URL.push(path + "hopen.wav");
  this.URL.push(path + "tongue.wav");
  this.URL.push(path + "mana.wav");
  
  this.URL.push(path + "aaaOpen.wav");
  this.URL.push(path + "aaa.wav");
  this.URL.push(path + "eee.wav");
  this.URL.push(path + "iii.wav");
  this.URL.push(path + "ooo.wav");
  this.URL.push(path + "uuu.wav");
  
  this.URL.push(path + "sh_h.wav");
  this.URL.push(path + "s_h.wav");
  this.URL.push(path + "f.wav");
  this.URL.push(path + "ja.wav");
  
  // silence
  this.URL.push(path + "silence.wav");
  
  
  
  
  
  
  
  var urlNum = 6;
  
  // Sound source
	this._sample = context.createBufferSource();
  // Gain Node
  this._gainNode = context.createGain();
  // Analyser
  this._analyser = context.createAnalyser();
  // FFT smoothing
  this._analyser.smoothingTimeConstant = this._smoothness;
  

  // MFCC
  this.opts = {};
  this.defineHTKdefault(this.opts);
  this.opts.mfccDim = this.mfccDim;
  this.MFCC = new MFCC(this._analyser, this.opts);
  
  LS.Globals.MFCC = this.MFCC;
  
  // Load GMM
  /*var URLGMMFile = "https://webglstudio.org/latest/fileserver/files//gerard/MFCCs%20lipsync/jnas-mono-16mix-gid.hmmdefs";
	this.gmm = new Model(URLGMMFile, this.mfccDim);
  LS.Globals.gmm = this.gmm;*/
  
  // Start mic
  this.startMicrophone();
  // Load sample
  var url = this.URL[urlNum];
  //this.loadSample(url);
  console.log(this.URL[urlNum]);
}

var once = false;
LS.Globals.baseProb = [];
// UPDATE
this.onUpdate = function(){
  
  // Extract MFCCs
  if (this._audioReady){
  	this.MFCC.computeMFCCs();
  
    // Compute GMM
    /*if (this.gmm.ready){
      if (!once){
        // Force model
        var letter = this.letter;
        var state = this.state;
        var meanModel = [];
        
        for (var i = 0; i<this.mfccDim; i++) meanModel[i]=0;
        // Find mean
        if (this.gmm.model[letter]){
          for (var i = 0; i<this.gmm.model[letter][state].length;i++){
            for (var j = 0; j<this.mfccDim; j++){
              meanModel[j] += this.gmm.model[letter][state][i].mean[j];
            }
          }
          for (var i = 0; i<this.mfccDim; i++)
            meanModel[i] /= this.gmm.model[letter][state].length;
        }
        
        //for (var i = 0; i < this.MFCC.mfcc.length; i++)
        //  this.MFCC.mfcc[i] = this.gmm.model.a[0][4].mean[i];
      	//this.gmm.compute(this.MFCC.mfcc);
        this.gmm.compute(meanModel);
        var keys = Object.keys(this.gmm.phonemeP);
        for (var i = 0; i<keys.length; i++)
        	LS.Globals.baseProb[i] = this.gmm.phonemeP[keys[i]];
        
        once = true;
        
      } else
        this.gmm.compute(this.MFCC.mfcc);
    }*/
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
  
  // Init MFCC calculation and create filter banks
  this.MFCC.init(context.sampleRate);
  this._audioReady = true;
  
  // start
  this._sample.start(0);
  this._sample.loop = true;
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
    // Init MFCC calculation and create filter banks
    that.MFCC.init(context.sampleRate);
    that._audioReady = true;

  }, function(e){console.log("ERROR: get user media: ", e);});
  
}


this.loadSample = function(inURL){
  var URL = LS.RM.getFullURL (inURL);
  var request = new XMLHttpRequest();
	request.open('GET', URL, true);
	request.responseType = 'arraybuffer';
  
  console.log("Loading audio.");
  this.loading = true;
  
  var that = this;
	request.onload = function(){
		context.decodeAudioData(request.response,
			function(buffer){
        that.stopSample();
        that._sample = context.createBufferSource();
				that._sample.buffer = buffer;
        console.log("Audio loaded", URL);
        that.playSample();
        that.loading = false;
			}, function(e){ console.error("Failed to load audio", URL); that.loading = false;});
	};
	request.send();
}



// DRAG AND DROP - audio files
this.onFileDrop = function(data) {

  var that = this;
  file = data.file;

  var reader = new FileReader();
  
  console.log("Dropped audio file: " + file.name);
  reader.onload = function(e)
  {
    console.log("Reading...");
    var filedata = e.target.result;
    LS.Globals.AContext.decodeAudioData(filedata, function(buffer) {
      that.stopSample();
      that.loadBuffer(buffer);
		});
  };
  reader.readAsArrayBuffer(file)
  
  return false;
}

// For drag and drop files
this.loadBuffer = function(buffer){

  console.log("Loading buffer");
  this._sample = LS.Globals.AContext.createBufferSource();
  this._sample.buffer = buffer;

  this.playSample();
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



this.defineHTKdefault = function(opts){
  opts.smpFreq = 16000;
  opts.smpPeriod = 625;
  opts.frameSize = 400;
  opts.fShift = 160;
  
  opts.lowFreq = 0;
  opts.highFreq = 8000;
  opts.preEmph = 0.97;
  opts.fBankNum = 20; // 24 in julius, 20 in HTK
  opts.lifter = 22;
  opts.deltaWin = 2;
  opts.rawE = false; // false in Julius, true in HTK
  opts.enormal = false; // false in Julius, true in HTK
  opts.escale = 1; // 1 in Julius, 0.2 in HTK. Not used
  opts.silFloor = 50; 
}


/* Juluius
http://www.sp.nitech.ac.jp/~ri/julius-dev/doxygen/julius/4.1.2/en/mfcc-core_8c.html
https://github.com/julius-speech/julius/blob/908275fc44ff3212ad898f2288457420fdb5c7b8/libsent/include/sent/mfcc.h
 * The default values here are the ones used in the standard acoustic models
 * distributed together with Julius, and some of them have different value from
 * HTK defaults.  So be careful of the default values.

MFCC_E_D_N_Z = MFCC(12) + DELTA_MFCC(12) + DELTA_ENERGY(1) (CMN)                   25-dimension

--- Some definitions:
#define DEF_SMPPERIOD   625	///< Default sampling period in 100ns (625 = 16kHz)
#define DEF_FRAMESIZE   400	///< Default Window size in samples, similar to WINDOWSIZE in HTK (unit is different)
#define DEF_FFTNUM      512	///< Number of FFT steps
#define DEF_FRAMESHIFT  160	///< Default frame shift length in samples
#define DEF_PREENPH     0.97	///< Default pre-emphasis coefficient, corresponds to PREEMCOEF in HTK
#define DEF_MFCCDIM     12	///< Default number of MFCC dimension, corresponds to NUMCEPS in HTK
#define DEF_CEPLIF      22	///< Default cepstral Liftering coefficient, corresponds to CEPLIFTER in HTK
#define DEF_FBANK       24	///< Default number of filterbank channels, corresponds to NUMCHANS in HTK
#define DEF_DELWIN      2	///< Default delta window size, corresponds to DELTAWINDOW in HTK
#define DEF_ACCWIN      2	///< Default acceleration window size, corresponds to ACCWINDOW in HTK
#define DEF_SILFLOOR    50.0	///< Default energy silence floor in dBs, corresponds to SILFLOOR in HTK
#define DEF_ESCALE      1.0	///< Default scaling coefficient of log energy, corresponds to ESCALE in HTK

#define DEF_SSALPHA     2.0	///< Default alpha coefficient for spectral subtraction
#define DEF_SSFLOOR     0.5	///< Default flooring coefficient for spectral subtraction


make_default_para(Value *para)
{
  para->basetype   = F_MFCC;
  para->smp_period = 625;	// 16kHz = 625 100ns unit 
  para->smp_freq   = 16000;	// 16kHz = 625 100ns unit 
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
  para->cvn	   = FALSE;
  para->hipass     = -1;	//disabled 
  para->lopass     = -1;	// disabled 
  //para->ss_alpha    = DEF_SSALPHA;
  //para->ss_floor    = DEF_SSFLOOR;
  para->vtln_alpha = 1.0;	// disabled 
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
  para->framesize  = 256000.0;	// dummy! 
  para->preEmph    = 0.97;
  para->fbank_num  = 20;
  para->lifter     = 22;
  para->delWin     = 2;
  para->accWin     = 2;
  para->raw_e      = TRUE;
  para->enormal    = TRUE;
  para->escale     = 0.1;
  para->silFloor   = 50.0;
  para->hipass     = -1;	// disabled 
  para->lopass     = -1;	// disabled 
  para->vtln_alpha = 1.0;	// disabled 
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

MFCC_E_D_N_Z

_E ->  log (sum(signal^2))
This normalisation is implemented by subtracting the maximum value of _E in 
the utterance and adding 1.0. The lowest energy in the utterance can be clamped using
the confguration parameter SILFLOOR which gives the ratio between the maximum and minimum
energies in the utterance in dB. Its default value is 50dB. Finally, the overall log energy can be
arbitrarily scaled by the value of the confguration parameter ESCALE whose default is 0:1.

_N
By including the _E qualifer together with the _N qualifer, the
absolute energy is suppressed leaving just the delta and acceleration 
coeffcients of the energy.

_Z
To perform this so-called Cepstral Mean Normalisation (CMN) in HTK it is
only necessary to add the _Z qualifier to the target parameter kind. The mean 
is estimated by computing the average of each cepstral parameter across each input 
speech file.



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
