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

// Audio sources
// URLs
this.URL = [];

// Microphone
navigator.getUserMedia  = navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia;


// MFCCs banks and results
this.filterBanks = [];
this.filteredEnergies = [];
this.logFiltE = [];
this.cepstralCoeff = [];
this.mfcc = [];
this.MFCC_E_D_N_Z = [];


// Delta
this.prevMFCC = [];
this.deltaCoeff = [];

// MFCC parameters
this.numFilters = 24; // Julius 24
this._mfccDim = 12;
this.minFreq = 0; // Julius disables hiPass and loPass, max-min freqs? Sampling rate?
this.maxFreq = 8000; // mHi is 8000kHz in Julius
// Julius
this.fftSize = 512;
//this.smpPeriod = 625; // 1/16000
//this.smpFreq = 16000; // 16kHz
//this.frameSize = 512;
//this.frameShift = 160; // 10 ms equals to 160 samples
//this.preEmph = 0.97;
//this.fBankNum = this.numFilters = 24; // Number of filters
this.lifter = 22;
this.deltaWin = 2; // Delta window
this.visualizationMFCC = 0;


// CMN - Cepstral Mean Normalization
this._cmn = null;



// START
this.onStart = function(){
  // I see five lamps
  this.URL.push("https://webglstudio.org/latest/fileserver/files//gerard/audios/i-have-four-airplanes-f.wav");

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
  
  // FFT buffer
  this._data = new Float32Array(this._analyser.frequencyBinCount);
  this._powerSpec = new Float32Array(this._analyser.frequencyBinCount);
  // Waveform
  this._wave = new Float32Array(this._analyser.fftSize);
  
  
  
  // Create filter banks (numFilters, minFreq, maxFreq);
  this.createFilterBanks(this.numFilters, this.minFreq, this.maxFreq);
  
  // Previous coeff initialization
  for (var i = 0; i<this.deltaWin + this.visualizationMFCC; i++){
    this.prevMFCC[i] = [];
    for (var j = 0; j<this.mfccDim+1; j++)
      this.prevMFCC[i][j] = -1;
  }

  
  // CMN
  this._cmn = new CMN (this._mfccDim);

  
  // Start mic
  this.startMicrophone();
}



// UPDATE
this.onUpdate = function(){
  
  // Extract MFCCs
  this.computeMFCCs();
  
  node.scene.refresh();
}


this.onFinish = function(){
  
  this.stopSample();
}



//MFCC_E_D_N_Z = MFCC(12) + DELTA_MFCC(12) + DELTA_ENERGY(1) (CMN)     25-dimension
//https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libjulius/src/realtime-1stpass.c
// real-time1rstpass
// RealTimeMFCC

this.computeMFCCs = function(){
  if (!this._audioReady)
    return;
  // Signal treatement (not done)
  // Preemphasize -> wave[i] -= wave[i - 1] * preEmph;
  // if "-ssload", load noise spectrum for spectral subtraction from file
  
  // FFT data
	this._analyser.getFloatFrequencyData(this._data);
  this._analyser.getFloatTimeDomainData(this._wave);
  
  // FFT not computed yet
  if ((this._data[0]) === -Infinity) 
    return;
  
  // Signal properties
  var nfft = this._analyser.frequencyBinCount;
  var fftSize = this._analyser.fftSize;
  var fs = context.sampleRate;
  var nFilt = this.filterBanks.length;// this.numFilters

  // Calculate Log Raw Energy
  var energy2 = 0;
  for (var i = 0; i<fftSize; i++)
    energy2 += this._wave[i] * this._wave[i];
  var energy = Math.log(energy2);
  
  //if (energy>0)
  //	console.log("ENERGY--> ", energy);
  
  this.mfcc = [];
  
  // Apply filters
  var filteredEnergies = this.filteredEnergies;
  var logFiltE = this.logFiltE;
  // Filter the signal and get filter coefficients
  for (var i = 0; i<nFilt; i++){
    filteredEnergies[i] = 0;
    for (var j = 0; j<nfft; j++){ // this.filterBanks[i].length = nfft
      var invLog = Math.pow(10, this._data[j]/20); // Remove last step (20*log10(data))
      invLog *= fftSize; // Remove division
      invLog = Math.sqrt(invLog * invLog); // Power
      //invLog /= fftSize; // Take back division (in practial crypt. but not in julius code)
      this._powerSpec[j] = invLog; // Power spectrum
      filteredEnergies[i] += this.filterBanks[i][j] *  invLog;
    }

    // Log
    if (filteredEnergies[i]<1 ) filteredEnergies[i] = 1;
    logFiltE[i] = Math.log(filteredEnergies[i]);
    
    //if (filteredEnergies[i]>1)
    //  console.log(i, filteredEnergies[i].toFixed(3), logFiltE[i].toFixed(3));
  }
  

  var cepCoeff = this.cepstralCoeff;
  var mfccDim = this._mfccDim;
  var sqrt2var = Math.sqrt(2.0/nFilt);
  // DCT of the coefficients
  for (var i = 0; i<mfccDim; i++){
    cepCoeff[i] = 0;
    for (var j = 0; j<nFilt; j++){ // fbank dim
      // Same as Julius
      cepCoeff[i] += logFiltE[j] * Math.cos(i*Math.PI/nFilt * (j - 0.5));
    }
    cepCoeff[i] *= sqrt2var; // in Julius
    
    //exception if i == 0? // Not in Julius? Why is this here?
    //cepCoeff[i] *= (i==0) ? 1/Math.sqrt(nFilt) : Math.sqrt(2/nFilt);
  }
  
  
  var lifter = this.lifter;
  var mfcc = this.mfcc;
  // Weight cepstrums (Julius without MFCC_SINCOS_TABLE)
  for (var i = 0; i < mfccDim; i++){
    var cepWin = 1.0 + lifter/2 * Math.sin((i+1) * Math.PI/lifter);
    mfcc[i] = cepCoeff[i] * cepWin;
  }
  
  mfcc[mfccDim] = energy; // 13 numbers (12 mfcc + energy)
  
  var deltaCoeff = this.deltaCoeff;
  var prevMFCC = this.prevMFCC;
  var divisor = 0;
  for (var n = 1; n <= this.deltaWin; n++) divisor += n * n;
  divisor *= 2;

  // Delta coefficients
  // Should compare the next and the past frame. As the next is not available in real-time,
  // the current mfcc is used.
  for (var i = 0; i<mfccDim+1; i++){
    var sum = 0;
    for (var n = 1; n <= this.deltaWin; n++){
    	// First iterations
      if (prevMFCC[n-1][i] == -1)
        prevMFCC[n-1][i] = mfcc[i];
      // Compute delta coefficients
      // From the book it should be something like [b] [a] [current] [i] [j] -> (i-a) + (j-b)
      // But: the mfcc calculation rate is not the same in each app (at least in our case as we don't
      // calculate them in a regular timestamp)
      // Then: the temporal relation between previous mfcc will not be the same as trained. Is it still
      // worth it?
      // In Julius the next frame is solved like:
      // p = currentFrame + theta; -> theta being 1 or 2 (n)
      // if (p <= previousMFCC.length) p -= previousMFCC.length; -> always picking positions 0 and 1
      sum += n*(mfcc[i] - prevMFCC[n-1][i]);       
  	}
    deltaCoeff[i] = sum / divisor;
    mfcc[i + mfccDim + 1] = deltaCoeff[i]; // 26 dimensions
  }
  
  // Assign to prevMFCC (should this values normalized CMN?)
  for (var i = 0; i<mfccDim+1; i++){
    // Move to the right
    var prevMFCCLength = this.deltaWin + this.visualizationMFCC
    for (var j = 1; j< prevMFCCLength; j++) // Store more for visualization
      //prevMFCC[this.deltaWin-j][i] = prevMFCC[this.deltaWin-j-1][i];
      prevMFCC[prevMFCCLength-j][i] = prevMFCC[prevMFCCLength-j-1][i];
    // Store current result
    prevMFCC[0][i] = mfcc[i];
  }
  
  

  // Nope
  //if (para->energy && para->enormal) // enormal is set to false in default parameters
	// Maybe?
  //#ifdef POWER_REJECT ?

  // Remove ENERGY from mfcc array
  mfcc.splice(12, 1);
  // MFCC is now MFCC(12) + DELTA_MFCC(12) + DELTA_ENERGY(1)
  
  
  
  // Cepstral Mean Normalization (CMN)
  mfcc = this._cmn.realtime(mfcc);
  // Update
  this._cmn.update();
  
}









this.freq2mfcc = function(f){return 1127 * Math.log(1+f/700);}
this.mfcc2freq = function(m){return 700*(Math.exp(m/1127) - 1);}

// TODO: instead of creating a filter for each bank, create just one side of the ramp /|/|/|/|...
// TODO: optimize to highFreq, no need to go over all bins!
this.createFilterBanks = function(numFilters, lowFreq, highFreq){
  
  // Half of the fft size
  var nfft = this._analyser.frequencyBinCount;
  // Sampling frequency
  var fs = context.sampleRate;
  
  
  // Create mel and freq points
  var mLF = this.freq2mfcc(lowFreq);
  var mHF = this.freq2mfcc(highFreq);
  var melPoints = [];
  var freqBins = [];
  for (var i = 0; i<numFilters+2; i++){
    melPoints[i] = mLF + i*(mHF-mLF)/(numFilters+1); 
    var hertzPoint = this.mfcc2freq(melPoints[i]);
  	freqBins[i] = Math.floor(hertzPoint*nfft/(fs/2));
  }

  
  // Create filter banks
  for (var i = 0; i < numFilters; i++){
    this.filterBanks[i] = new Array(nfft);
    // Create triangular filter
    for (var j = 0; j < nfft; j++){
      // Zero
      if (j<=freqBins[i])
        this.filterBanks[i][j] = 0;
      // Ramp up
      else if (j>=freqBins[i] && j<=freqBins[i+1])
        this.filterBanks[i][j] = (j-freqBins[i])/(freqBins[i+1]- freqBins[i]);
      // Ramp down
      else if (j>freqBins[i+1] && j<=freqBins[i+2])
        this.filterBanks[i][j] = (freqBins[i+2]-j)/(freqBins[i+2]- freqBins[i+1]);
      // Zero
      else if (j>freqBins[i+2])
        this.filterBanks[i][j] = 0;
    }
    
  }
}





this.playSample = function(){

  // Sample to analyser
  this._sample.connect (this._analyser);
  // Analyser to Gain
  this._analyser.connect(this._gainNode);  
  // Gain to Hardware
  this._gainNode.connect(context.destination);
  
  console.log("File Sample Rate:", context.sampleRate, "Hz.");
  
  // Create filter banks (numFilters, minFreq, maxFreq);
  this.createFilterBanks(this.numFilters, this.minFreq, this.maxFreq);
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
    // Create filter banks (numFilters, minFreq, maxFreq);
  	that.createFilterBanks(that.numFilters, that.minFreq, that.maxFreq);
    that._audioReady = true;
    //this._analyser.connect(this._gainNode);
  //this._gainNode.connect(context.destination);
  }, function(e){console.log("ERROR: get user media: ", e);});
  
}

this.stopSample = function(){
  // If AudioBufferSourceNode has started
  if(this._sample)
    if(this._sample.buffer){
      this._sample.stop(0);
      that._audioReady = false;
    }
  
  // If microphone input
  if (this._stream){
    this._stream.getTracks()[0].stop();
    console.log(this._stream.getTracks());
    that._audioReady = false;
  }
}





// ------------------ GUI ------------------

this.onRenderGUI = function(){
  width = gl.viewport_data[2];
  height = gl.viewport_data[3];
  
  gl.start2D();
  
  // Filter banks
  var nfft = 512;
  gl.translate(40,50);
  if (this.filterBanks){
    for (var i = 0; i<this.filterBanks.length; i++){
      gl.beginPath();
      // Draw lines
      gl.moveTo(0,0);
      for (var j = 0; j<nfft; j++)
        gl.lineTo(j * 512/nfft, -this.filterBanks[i][j]*20);
      
      gl.strokeStyle = "rgba(255,255,255,0.9)";
      gl.stroke();
    }
  }
  gl.translate(-40,-50);
  
  
  // FFT
  if (this._data){
    gl.beginPath();
    gl.translate(40,100);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<nfft; i++)
      gl.lineTo(i * 512/nfft, -45 - (this._data[i]+20)/1.4);
    
    gl.strokeStyle = "rgba(255,255,255,0.9)";
    gl.stroke();

    gl.translate(-40,-100);
  }
  
  
  // Power Spectrogram
  if (this._powerSpec){
    gl.beginPath();
    gl.translate(40,100);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<nfft; i++)
      gl.lineTo(i * 512/nfft, -this._powerSpec[i]*1);
    
    gl.strokeStyle = "rgba(127,255,127,0.9)";
    gl.stroke();

    gl.translate(-40,-100);
  }
  
  
  // Wave
  if (this._wave){
    gl.beginPath();
    gl.translate(40,200);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<this._wave.length; i++)
      gl.lineTo(i *0.5, this._wave[i]*100);
    
    gl.strokeStyle = "rgba(255,255,255,0.9)";
    gl.stroke();

    gl.translate(-40,-200);
  }
  
  
  // MFCC visualization
  // max mfcc ~= 32 / training = 18
  // max delta ~= 8 / training = 5
  // max energy ~= 5 / training = 2
  if (this.prevMFCC){
    
    if (this.prevMFCC[0]){
      gl.translate(40,300);
      
      var prevMFCC = this.prevMFCC;
      var rect = {x: 0, y: 0, w: 20, h: 20};

      for (var n = 0; n < prevMFCC.length; n++) 
        for (var i = 0; i < prevMFCC[n].length; i++){
          var hue = prevMFCC[n][i]*10;//(prevMFCC[n][i]*10 + 240) % 360;
          
          gl.fillStyle = "rgba(" + hue + ", 0, 0, 0.5)"; //"hsla("+hue+", 100%, 50%, 0.5)";
          if (i == 12)
          	gl.fillStyle = "rgba(0," + hue*5 + ", 0, 0.5)"; //"hsla("+hue+", 100%, 50%, 0.5)";
          gl.fillRect(rect.x + n*rect.w, rect.y + i*rect.h, rect.w, rect.h);
        }
    
    	gl.translate(-40,-300);
    }
  }
  
  
  gl.finish2D();
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