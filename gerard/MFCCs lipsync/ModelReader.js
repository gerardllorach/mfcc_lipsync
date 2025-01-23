//@Compute GMM

// Reads phoneme model jnas-mono-16mix-gid.hmmdefs
// Calculates GMM
// Defines macros 
// https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libsent/include/sent/stddefs.h
var LOG_ZERO = -1000000;
var LOG_ADDMIN = -13.815510558;
var INV_LOG_TEN = 0.434294482;

var max = LOG_ZERO;
var min = 0;

function Model(URL, mfccDim){
  
  this.model = {};
  this.prob = {};
  this.phonemeP = {};
  // Several frames
  this.probOverTime = {};
  this.nFrame = 20; // 20 default if GMM_VAD - gmm_margin
  // Compute several states?
  this.nStates = 1;
  // MFCC comparison dimension (default 25)
  this.mfccDim = mfccDim || 12;
  
  this.ready = false;
  
  // Julius log table for GMM computation
  this.makeLogTbl();
  
  // Read GMM model
  this.read(URL);
    
}

// Calculate mixtures
Model.prototype.compute = function(mfcc){
  
  
  
  this.maxProb = LOG_ZERO;
  this.minProb = 0;
  this.result = "";
  this.resultLow = "";
  

  
  var phonemes = Object.keys(this.model);
  var prob = this.prob;
  var phonemeP = this.phonemeP;
  
  
  // gmm_proceed
  // outprob_state_nocache
  // gmm_calc_mix
  // gmm_gprune_safe
  // gmm_compute_g_safe
  // https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libjulius/src/gmm.c
  for (var p = 0; p < phonemes.length; p++){
    var ph = phonemes[p]; // key name
    var phModel = this.model[ph];
    prob[ph] = [];
    phonemeP[ph] = {};
    var gmm_score = this.gmm_score = [];
    // 3 States? Only one in Julius? d->s[1]
    // outprob_state_nocache(gc, mfcc->f, d->s[1], mfcc->param);
    for (var s = 0; s < this.nStates; s++){
      gmm_score[s] = 0;
      for (var i = 0; i < phModel[s].length; i++){ // phModel[s].length = 16
        var g = phModel[s][i];
        var tmp = g.gconst;
        //for (var j = 0; j < mfcc.length; j++){ // mfcc.length = g.mean.length = 25
        for (var j = 0; j < this.mfccDim; j++){ // No deltas! // *************** MODIFICATION!! Deltas are computed every 16ms, not as Julius
          var x = mfcc[j]-g.mean[j];
          tmp += x * x * g.variance[j];
  //-------------------------------------------------------
        }
        tmp *= -0.5;
        // In Julius, the stored values for each gaussian mixture (1 of the 16) are LOGPROB
        // They use a table to compute the logarithm
        // static LOGPROB tbl[TBLSIZE];    ///< Table of @f$\log (1+e^x)@f$
        // Check: 
        // https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libsent/src/phmm/addlog.c
        prob[ph][i] = tmp;
      }

      // - Adds to each score a mixture weight from HMM: "state->pdf[s]->bweight[gc->OP_calced_id[i]];"
      for (var i = 0; i < phModel.length; i++){
        prob[ph][i]+= phModel[i][s].bweight;
      }

      // Sort probabilities (higher at the end)
      // Should be done before adding bweight, but change might be trivial (bweight = (-2,-3))
      prob[ph].sort(function(a, b){return a-b});

      // addlog_array
      var x = 0;
      var y = LOG_ZERO;
      var tmp = 0;
      // Add probabilities of the 16 gaussians
      // In Julius, just the best first 10
      for (var i = 6; i < phModel[s].length; i++){
        // addlog_array -> a unique value for each of the 16 gaussians
        x = prob[ph][i];
        if (x > y){
          tmp = x;
          x = y;
          y = tmp;
        }
        if ((tmp = x-y) < LOG_ADDMIN) continue;
        else{
          var idx = Math.floor(Math.abs(-tmp * this.tMag + 0.5));
          y += this.tbl[idx];
        }
      }
      // gmm_calc_mix
      var logsum = y;//phonemeP[ph] = y; // Unique value
      // - If states, add all 3 unique state values to check if valid stream or lowest
      // If a state prob sum is bigger than LOG_ZERO use it.
      //if (phonemeP[ph] == 0.0 || phonemeP[ph] <= LOG_ZERO) phonemeP[ph] = LOG_ZERO;
      //else phonemeP[ph] *= INV_LOG_TEN;
      if (logsum == 0.0 || logsum <= LOG_ZERO) logsum = LOG_ZERO;
      else logsum *= INV_LOG_TEN;
      // Return prob[ph] * INV_LOG_TEN in gmm_calc_mix:
      // https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libjulius/src/gmm.c
      // outprob_state_nocache
      
      // gmm_proceed
      gmm_score[s] = logsum;
      //phonemeP[ph]+=logsum;
      
    } // End FOR state
    
    
    // Find best of each state and compute confidence measure (CM)
    // gmm_end compute maxProb
    var tmpMax = LOG_ZERO;
    for (s = 0; s <this.nStates; s++){
      if (tmpMax < gmm_score[s]){
        phonemeP[ph].prob = gmm_score[s];
        tmpMax = gmm_score[s];
      }
    }

    // Several frames
    // Shift
    this.probOverTime[ph].shift();
    // Store new prob (last item)
    this.probOverTime[ph][this.nFrame-1] = tmpMax;

    
    // Compute addition
    phonemeP[ph].prob = 0;
    for (var i = 0; i< this.nFrame; i++)
    	phonemeP[ph].prob+=this.probOverTime[ph][i];
    
    
    if (phonemeP[ph].prob > this.maxProb){
      this.maxProb = phonemeP[ph].prob;
      this.result = ph;
      this.confidence = phonemeP[ph].conf;
    }if (phonemeP[ph].prob < this.minProb){
      this.minProb = phonemeP[ph].prob;
      this.resultLow = ph;
    }
    
  } // End for phonemes
  
  // Compute confidence measure (CM)
  // gmm_proceed -> for several frames add scores
  // gmm_end -> compute confidence measure
  var sum = 0;
  for (var p = 0; p < phonemes.length; p++){
    var ph = phonemes[p]; // key name
    sum += Math.pow(10, 0.05 * (phonemeP[ph].prob-this.maxProb));
  }
  
  this.confidence = 1/sum;
  //phonemeP[ph].conf = sum;
  
  
  //console.log("PHONEME:", this.result, ", CM:", sum);
  
}






Model.prototype.makeLogTbl = function(){
  this.tbl = []; // length = 500000 = tblSize
  this.tblSize = 500000; // Table size (precision depends on this)
  this.vRange = 15; // Must be larger than -LOG_ADDMIN
  this.tMag = 33333.3333 // TBLSIZE / VRANGE
  
  var f = 0;
  for (var i = 0; i<this.tblSize; i++){
    f = - this.vRange * i / this.tblSize;
    this.tbl[i] = Math.log(1+Math.exp(f));
  }
}




Model.prototype.read = function(url){
  
  var that = this;
	var req = new XMLHttpRequest();
	
	req.open('GET', url, true);
  
  req.onload = function()
	{
		var response = this.response;
		if(this.status < 200 || this.status >= 300)
			return console.error("File not found: ", this.status);
    
    console.log("Finised loading.");
		that.ready = that.parse(this.response);
		
		return;
	}
  
  req.addEventListener("progress", function(e){
    var progress = e.loaded/e.total;
    console.log("Download progress: ", progress);
  });
  
  req.send();
}


Model.prototype.parse = function(data){
  // Each new phoneme starts with ~h
  var phonemeData = data.split("~h");
  phonemeData.shift();
  phonemeData.shift();
  
  // There are 42 phonemes (approx) sil stands for silence
  for (var i = 0; i<phonemeData.length; i++){
    
    // The name of the phoneme is inside quotation marks
    var tmp = phonemeData[i].split('\"');
    var phoneme = tmp[1];
    // Store 16 GMM for each phoneme (there are 16x3 states)
    this.model[phoneme] = [];

    // Each letter has 3 states. Each state has 16 GMM (mixture, mean, variance). 48 GMM in total.
    var phonemeContent = tmp[2];
   
		// 3 states
		var states = phonemeContent.split("<STATE>");
    states.shift();
    
    for (var s = 0; s < 3; s++){
      var stateContent = states[s];
      this.model[phoneme][s] = [];
      
      // 16 mixtures
      var mixContent = stateContent.split("<MIXTURE>");
      mixContent.shift(); // First part is not a mixture

      for (var j = 0; j<mixContent.length; j++){
        var mix = {};
        var mixData = mixContent[j].split("\n");
        //https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libsent/src/hmminfo/rdhmmdef_mpdf.c
        // mixture is bweight in Julius
        mix.bweight = Math.log(parseFloat(mixData[0].split(" ")[2]));
        mix.mean = mixData[2].split(" ");
        mix.mean.shift();
        // Variance is var->vec[]
        mix.variance = mixData[4].split(" ");
        mix.variance.shift();
        for (var k = 0; k < mix.mean.length; k++){
          mix.mean[k] = parseFloat(mix.mean[k]);
          // Variance is inversed in Julius
          mix.variance[k] = 1/parseFloat(mix.variance[k]);
        }
        mix.gconst = parseFloat(mixData[5].split(" ")[1]);

        this.model[phoneme][s].push(mix);
      }
      
    }
    
  }
  
  // Prepare previous probabilities array
  var phonemes = Object.keys(this.model);
  // Use several frames to compute probs (init) TODOOOOOO
  for (var p = 0; p < phonemes.length; p++){
    var ph = phonemes[p]; // key name
    this.probOverTime[ph] = [];
    for (var i = 0; i<this.nFrame; i++)
      this.probOverTime[ph][i] = LOG_ZERO;
  }


  console.log("Finised parsing.");//, this.model);
  return true;
	//console.log(this.model);


}