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
  this.fs = 441000;
  
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
  this.numFilters = opt.numFilters || opt.fBankNum || 24; // Julius 24
  this.mfccDim = opt.mfccDim || 12;
  this.lowFreq = 0; // Julius disables hiPass and loPass, max-min freqs? Sampling rate?
  this.highFreq = 8000; // mHi is 8000kHz in Julius

  this.fftSize = analyser.fftSize; // 512;
  this.lifter = opt.lifter || 22;
  this.deltaWin = opt.deltaWin || 2; // Delta window
  this.visualizationMFCC = opt.visualizationMFCC || 10;


  // CMN - Cepstral Mean Normalization
  this.cmn = null;
  
}






// Init
MFCC.prototype.init = function(){
  
  // FFT buffer
  this.data = new Float32Array(this.analyser.frequencyBinCount);
  this.powerSpec = new Float32Array(this.analyser.frequencyBinCount);
  // Waveform
  this.wave = new Float32Array(this.analyser.fftSize);
  
  
  // Create filter banks
  this.createFilterBanks();
  
  // Previous coeff initialization
  for (var i = 0; i<(this.deltaWin*2+1) + this.visualizationMFCC; i++){
    this.prevMFCC[i] = [];
    for (var j = 0; j<this.mfccDim+1; j++)
      this.prevMFCC[i][j] = -1;
  }

  // CMN
  this.cmn = new CMN (this.mfccDim);
  
}


//MFCC_E_D_N_Z = MFCC(12) + DELTA_MFCC(12) + DELTA_ENERGY(1) (CMN)     25-dimension
//https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libjulius/src/realtime-1stpass.c
// real-time1rstpass
// RealTimeMFCC

MFCC.prototype.computeMFCCs = function(){
  
  // Signal treatement (not done)
  // · Preemphasize -> wave[i] -= wave[i - 1] * preEmph;
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

  // Calculate Log Raw Energy
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
      invLog *= fftSize; // Remove division
      invLog = Math.sqrt(invLog * invLog); // Power
      //invLog /= fftSize; // Take back division (in practial crypt. but not in julius code)
      this.powerSpec[j] = invLog; // Power spectrum
      filteredEnergies[i] += this.filterBanks[i][j] *  invLog;
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
  //if (max > mfcc[mfccDim]){
  //  max = mfcc[mfccDim];
  //  console.log("MIN_ENERGY", mfcc[mfccDim]);
  //}
  
  
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
MFCC.prototype.freq2mfcc = function(f){return 1127 * Math.log(1+f/700);}
MFCC.prototype.mfcc2freq = function(m){return 700*(Math.exp(m/1127) - 1);}

// TODO: instead of creating a filter for each bank, create just one side of the ramp /|/|/|/|...
// TODO: optimize to highFreq, no need to go over all bins!
MFCC.prototype.createFilterBanks = function(){
  
  // Half of the fft size
  var nfft = this.analyser.frequencyBinCount;
  // Sampling frequency
  var fs = this.fs;
  // Filters
  var numFilters = this.numFilters;
  var lowFreq = this.lowFreq;
  var highFreq = this.highFreq;
  
  
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