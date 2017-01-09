//@MFCC Calculation
//MFCC_E_D_N_Z 
// _E energy (if _N and _Z, delta energy)
// _D delta
// _N absolute energy suppression
// _Z cepstral mean normalization (CMN)

// MFCC = MFCC(12) + DELTA_MFCC(12) + DELTA_ENERGY(1) (CMN)

function MFCC(analyser, opt){
  
  var opt = opt || {};
  
  this.analyser = analyser;
  
  // MFCCs banks
  this.filterBanks = [];
  this.filteredEnergies = [];
  
  // Pre-emphasis filter (freq domain)
  this.h = [];
  // DCT
  this.dct = [];
  // Cep lifter
  this.cepWin = [];
  
  // MFCC results
  this.logFiltE = [];
  this.cepstralCoeff = [];
  this.mfcc = [];
  this.MFCC_E_D_N_Z = [];
  
  // Delta
  this.prevMFCC = [];
  this.deltaCoeff = [];
  
  // MFCC parameters
  this.numFilters = this.nFilt = opt.numFilters || opt.fBankNum || 24; // Julius 24
  this.mfccDim = opt.mfccDim || 12;
  this.lowFreq = opt.lowFreq === undefined ? 0 : opt.lowFreq; // Julius disables hiPass and loPass, max-min freqs? Sampling rate?
  this.highFreq = opt.highFreq || 8000; // mHi is 8000kHz in Julius
  this.preEmph = opt.preEmph || 0.97;

  this.lifter = opt.lifter || 22;
  this.deltaWin = opt.deltaWin || 2; // Delta window
  this.visualizationMFCC = opt.visualizationMFCC || 10;
  
  // Signal processing parameters
  this.smpFreq = opt.smpFreq || 16000;
  this.smpPeriod = opt.smpPeriod || 625;
  this.frameSize = opt.frameSize || 400;
  this.fShift = opt.fShift || 160;

  // CMN - Cepstral Mean Normalization
  this.cmn = null;
  // CMN
  this.cmn = new CMN (this.mfccDim);
  
  
  
  // LOGS
  this.LOGMFCC = [];
  this.LOGCSV = this.LOGFBE = "time";
  for (var i = 0; i<this.mfccDim; i++)
    this.LOGCSV += ", mfcc" + i;
  for (var i = 0; i<this.numFilters; i++)
    this.LOGFBE += ", bin" + i;
  this.LOGCSV += "\n";
  this.LOGFBE += "\n";
  this.LOGMAG = "";
  this.startTime = 0;
  
  this.mag = [];
  this.fbe = [];
  this.cc = [];
  this.timestamp = [];
  
  
  this.max = -1000000;
  this.min = 1000000;
  
}





// Init
MFCC.prototype.init = function(fs){
  this.fs = fs || 44100;
  
  // Define fft size according to MFCC options
  var fftSecs = this.frameSize / this.smpFreq;
  var fftSamples = fftSecs * this.fs;
  // Find closer fftSize that's power of two
  var fftSize = 256;
  
  // fftSize has to be always bigger than fftSamples (Matlab)
  var diff = fftSize - fftSamples;
  while (diff < 0 && fftSize <= 32768){
  	fftSize *= 2;
    diff = fftSize - fftSamples;
  }

  
  /*
  var diff = Math.abs(fftSize - fftSamples);
  for (var i = 0; i < 6; i++){
    var nextFttSize = fftSize * 2;
    var nextDiff = Math.abs(nextFttSize - fftSamples);
    if ( nextDiff < diff){
      diff = Math.abs(nextFttSize - fftSamples);
      fftSize = nextFttSize;
    } else
			break;
  }
  */
  this.analyser.fftSize = this.fftSize = fftSize;
  
  console.log("FFT size:", fftSize);
  
  // FFT buffer
  this.data = new Float32Array(this.analyser.frequencyBinCount);
  this.powerSpec = new Float32Array(this.analyser.frequencyBinCount);
  // Waveform
  this.wave = new Float32Array(this.analyser.fftSize);
  
  
  // Create filter banks
  this.createFilterBanks();
  // Create DCT matrix
  this.createDCT();
  // Create ceplifter
  this.createLifter();
  
  // Previous coeff initialization
  for (var i = 0; i<(this.deltaWin*2+1) + this.visualizationMFCC; i++){
    this.prevMFCC[i] = [];
    for (var j = 0; j<this.mfccDim+1; j++)
      this.prevMFCC[i][j] = -1;
  }

}


//MFCC_E_D_N_Z = MFCC(12) + DELTA_MFCC(12) + DELTA_ENERGY(1) (CMN)     25-dimension
//https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libjulius/src/realtime-1stpass.c
// real-time1rstpass
// RealTimeMFCC

MFCC.prototype.computeMFCCs = function(){
  
  // Signal treatement (not done)
  // · Preemphasize -> wave[i] -= wave[i - 1] * preEmph;
  // Preemphize done in frequency domain
  // · if "-ssload", load noise spectrum for spectral subtraction from file
  
  // FFT and wave data
	this.analyser.getFloatFrequencyData(this.data);
  this.analyser.getFloatTimeDomainData(this.wave);
  
  // FFT not computed yet
  if ((this.data[0]) === -Infinity) 
    return;
  
  // Signal properties
  var nfft = this.analyser.frequencyBinCount;
  var fftSize = this.analyser.fftSize;
  var fs = this.fs;//context.sampleRate;
  var nFilt = this.filterBanks.length;// this.numFilters

  // Calculate Log Raw Energy (before preemphasize and windowing in HTK default)
  var energy2 = 0;
  for (var i = 0; i<fftSize; i++)
    energy2 += this.wave[i] * this.wave[i];
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
      var invLog = Math.pow(10, this.data[j]/20); // Remove last step (20*log10(data))
      invLog *= fftSize; // Remove division 1/N
      invLog *= 1/1.0 // Matlab fft compensation
      invLog = (Math.abs(invLog)); // Magnitude spectrum Matlab
      invLog *= Math.pow(2,15);//? Similar values to Matlab? MAG
      // Pre-emphasis filter
      invLog *= this.h[j];
      // Magnitude
      this.powerSpec[j] = invLog;
      filteredEnergies[i] += this.filterBanks[i][j] *  invLog;
      
      if (this.max < invLog)this.max = invLog;
      if (this.min > invLog) this.min = invLog;
      
    }

    // Log
    if (filteredEnergies[i]<1 ) filteredEnergies[i] = 1;
    logFiltE[i] = Math.log(filteredEnergies[i]);
    
    //if (filteredEnergies[i]>1)
    //  console.log(i, filteredEnergies[i].toFixed(3), logFiltE[i].toFixed(3));
  }


  var cepCoeff = this.cepstralCoeff;
  var mfccDim = this.mfccDim;
  var sqrt2var = Math.sqrt(2.0/nFilt);
  // DCT of the coefficients
  for (var i = 0; i<mfccDim; i++){
    cepCoeff[i] = 0;
    for (var j = 0; j<nFilt; j++){ // fbank dim
      // Same as Julius
      cepCoeff[i] += logFiltE[j] * this.dct[i][j];//Math.cos(i*Math.PI/nFilt * (j - 0.5));
    }
    //cepCoeff[i] *= sqrt2var; // in Julius
    
    //exception if i == 0? // Not in Julius? Why is this here?
    //cepCoeff[i] *= (i==0) ? 1/Math.sqrt(nFilt) : Math.sqrt(2/nFilt);
  }
  
  
  var lifter = this.lifter;
  var mfcc = this.mfcc;
  // Weight cepstrums (Julius without MFCC_SINCOS_TABLE)
  for (var i = 0; i < mfccDim; i++){
    mfcc[i] = cepCoeff[i] * this.cepWin[i];
  }
  
  mfcc[mfccDim] = energy; // 13 numbers (12 mfcc + energy)
  //if (max > mfcc[mfccDim]){
  //  max = mfcc[mfccDim];
  //  console.log("MIN_ENERGY", mfcc[mfccDim]);
  //}
  
  
  
  // Normalise log energy in HTK default
  // if (para->energy && para->enormal)
  // TODO, but only affects the energy parameter
  
  
  
  // Compute delta coefficients
  var deltaCoeff = this.deltaCoeff;
  var prevMFCC = this.prevMFCC;
  var divisor = 0;
  for (var n = 1; n <= this.deltaWin; n++) divisor += n * n;
  divisor *= 2;
  
  
  // LOGS
  if (this.LOGMFCC.length == 0)
    this.startTime = LS.Globals.AContext.currentTime;
  this.LOGMFCC.push({});
  var lastInd = this.LOGMFCC.length-1;
  var currentTime = LS.Globals.AContext.currentTime - this.startTime;
  if (currentTime < 2.6525){ // HARDCODED
    this.LOGMFCC[lastInd].time = currentTime;
    this.LOGMFCC[lastInd].mfcc = [];
    //this.LOGCSV += currentTime.toFixed(5);
    //this.LOGFBE += currentTime.toFixed(5);
    //this.LOGMAG += currentTime.toFixed(5);
    
    this.timestamp.push(currentTime);
    this.mag.push([]);
    this.fbe.push([]);
    this.cc.push([]);

    // CEPSTRAL COEFFICIENTS
    for (var i = 0; i<mfccDim; i++){
      this.cc[this.cc.length-1][i] = cepCoeff[i];
      //this.LOGMFCC[lastInd].mfcc[i] = mfcc[i];
      //this.LOGCSV += ", " + mfcc[i].toFixed(5);
    }

    // POWER SPECT
    for (var i = 0; i<nfft; i++){
      this.mag[this.mag.length-1][i] = this.powerSpec[i];
    }
    // FBE
    for (var i = 0; i< nFilt; i++)
      this.fbe[this.fbe.length-1][i] = filteredEnergies[i];
    
    this.LOGCSV += "\n";
    this.LOGFBE += "\n";
    this.LOGMAG += "\n";
  } else{
  	this.ended = true;
  }
    
  // Delta coefficients
  // Should compare the next and the past frame. As the next is not available in real-time,
  // the current mfcc is used.
  for (var i = 0; i<mfccDim+1; i++){
    var sum = 0;
    for (var n = 1; n <= this.deltaWin; n++){
      // Indices
      var nextIdx = this.deltaWin - n;
      var pastIdx = this.deltaWin + n;
    	// First iterations
      if (prevMFCC[nextIdx][i] == -1)
        prevMFCC[nextIdx][i] = mfcc[i];
      if (prevMFCC[pastIdx][i] == -1)
        prevMFCC[pastIdx][i] = mfcc[i];
      
      
      // Compute delta coefficients
      // From the book it should be something like [b] [a] [current] [i] [j] -> (i-a) + (j-b)
      // But: the mfcc calculation rate is not the same in each app (at least in our case as we don't
      // calculate them in a regular timestamp)
      // Then: the temporal relation between previous mfcc will not be the same as trained. Is it still
      // worth it?
      // In Julius the next frame is solved like:
      // p = currentFrame + theta; -> theta being 1 or 2 (n)
      sum += n*(prevMFCC[nextIdx][i] - prevMFCC[pastIdx][i]);       
  	}
    deltaCoeff[i] = sum / divisor;
    mfcc[i + mfccDim + 1] = deltaCoeff[i]; // 26 dimensions
  }
  
  // Assign to prevMFCC (should this values be normalized CMN? I don't think so)
  for (var i = 0; i<mfccDim+1; i++){
    // Move to the right
    var prevMFCCLength = (this.deltaWin*2+1) + this.visualizationMFCC;
    for (var j = 1; j< prevMFCCLength; j++) // Store more for visualization
      prevMFCC[prevMFCCLength-j][i] = prevMFCC[prevMFCCLength-j-1][i];
    // Store current result
    prevMFCC[0][i] = mfcc[i];
  }
  
  

	// Maybe?
  //#ifdef POWER_REJECT ?

  // Remove ENERGY from mfcc array
  mfcc.splice(12, 1);
  // MFCC is now MFCC(12) + DELTA_MFCC(12) + DELTA_ENERGY(1)
  
  
  // Cepstral Mean Normalization (CMN)
  mfcc = this.cmn.realtime(mfcc);
  // Update
  this.cmn.update();
  
}





// Create filter banks
MFCC.prototype.freq2mel = function(f){return 1127 * Math.log(1+f/700);}
MFCC.prototype.mel2freq = function(m){return 700*(Math.exp(m/1127) - 1);}



// Create filter banks Matlab implementation
MFCC.prototype.createFilterBanks = function(){
  
  // Half of the fft size
  var K = this.analyser.frequencyBinCount+1;
  var fftSize = this.fftSize;
  // Sampling frequency
  var fs = this.fs;
  // Filters
  var M = this.numFilters;
  var lowFreq = this.lowFreq;
  var highFreq = this.highFreq;
  var fMin = 0;
  var fMax = 0.5 * fs;
  
  
  
  // PRE EMPHASIS FILTER
  // Create pre-emphasis filter
  for (var i = 0; i < fftSize/2; i++){
    var w = i/(fftSize/2) * Math.PI;
    var real = 1 - this.preEmph*Math.cos(-w);
    var img = -this.preEmph*Math.sin(-w);
    this.h[i] = Math.sqrt(real*real + img*img);
  }
  
  
  var f = [];
  //var fw = [];
  // Create mel and freq points
  for (var i = 0; i<K; i++){
    f[i] = fMin + i*(fMax - fMin)/K;
    //fw[i] = this.freq2mel(f[i]);
  }
  
  
  // Create cutoff frequencies
  var c = [];
  //var cw = [];
  var mLF = this.freq2mel(lowFreq);
  var mHF = this.freq2mel(highFreq);
  for (var i = 0; i<M+2; i++){
  	c[i] = this.mel2freq(mLF + i*(mHF-mLF)/(M+1)); 
  	//cw[i] = this.freq2mel(c[i]);
  }
  

  // Create filter banks
  for (var i = 0; i < M; i++){
    this.filterBanks[i] = [];//new Array(K);
    // Create triangular filter
    for (var j = 0; j < K; j++){
      this.filterBanks[i][j] = 0;
      // Up-slope
      if (f[j]>=c[i] && f[j]<=c[i+1])
      	this.filterBanks[i][j] = (f[j] - c[i])/(c[i+1] - c[i]);
      // Down-slope
      if (f[j]>=c[i+1] && f[j]<=c[i+2])
        this.filterBanks[i][j] = (c[i+2]-f[j])/(c[i+2] - c[i+1]);
    }
    
  }
  
  // LOG FILTERBANKS
  this.LOGFB = "";
  for (var i = 0; i< K; i++)
  	this.LOGFB += "bin" + i + ", ";
  for (var i = 0; i < M; i++){
    this.LOGFB +="\n";
    for (var j = 0; j < K; j++)
      this.LOGFB += this.filterBanks[i][j] + ", ";
  }
}

// DCT matrix
MFCC.prototype.createDCT = function(){
  var mfccDim = this.mfccDim;
  var nFilt = this.nFilt;
  // DCT of the coefficients
  var sqrt2var = Math.sqrt(2/nFilt);
  for (var i = 0; i<mfccDim; i++){
    this.dct[i] = [];
    for (var j = 0; j<nFilt; j++){
      this.dct[i][j] = sqrt2var * Math.cos(i*Math.PI*((j+1)-0.5)/nFilt);
    }
  }
}

// Lifter coefficients
MFCC.prototype.createLifter = function(){
  var lifter = this.lifter;
  var mfccDim = this.mfccDim;
  // Weight cepstrums
  for (var i = 0; i < mfccDim; i++){
    this.cepWin[i] = 1.0 + lifter/2 * Math.sin(i * Math.PI/lifter);
  }
}


