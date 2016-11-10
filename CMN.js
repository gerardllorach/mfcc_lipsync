//@ Cepstral mean normalization

  // Cepstral Mean Normalization (CMN)

  // Cepstral mean normalization
  // Real time processing uses the previous input to calculate the current CMN
  // parameters, thus for the first input utterance CMN cannot be performed.
  // when the realtime option is ON the previous 5 second of input is always used.

  // CMN is meant for reducing noise and other variables, such as vocal tract. Explained here:
  // http://dsp.stackexchange.com/questions/19564/cepstral-mean-normalization
  

// Extracted from Julius wit default parameters
// https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/libsent/src/wav2mfcc/wav2mfcc-pipe.c
  // map_cmn = true;
  // mean = true
  // var = false
  // veclen = 25
  // mfcc_dim = 12
// https://github.com/julius-speech/julius/blob/6d135a686a74376495a7a6f55d3d67df54186f83/man/julius.1
  // cweight = 100 // default cmnmapweight
  // clist_max = CPSTEP
  // clist_num = 0;
  // clist = CMEAN object with CPSTEP elements {mfcc_sum, framenum}
  // now.mfcc_sum = array 25
  // cmean_init = array 25
  // all.framenum = 0
  // now.framenum = 0

function CMN (mfccDim){
  this.cweight = 100;
  this.mfccDim = mfccDim; // 12
  this.veclen = mfccDim * 2 + 1; // 25
  this.cpStep = 5; // CPSTEP
  this.cpMax = 500; // CPMAX
  this.clistMax = 5; // CPSTEP 
  this.clistNum = 0;
  this.clist = [];
  for (var i = 0; i<this.clistMax; i++){
    this.clist[i] = {};
    this.clist[i].mfcc_sum = [];
    this.clist[i].framenum = 0;
  }
  this.mfcc_sum = []; // veclen 25
  this.cmeanInit = []; // veclen
  this.cmeanInitSet = false;
  this.allFramenum = 0;
  
  this.init();
  
};



CMN.prototype.init = function(){
   for (var i = 0; i < this.veclen; i++) this.mfcc_sum[i] = 0;
  this.framenum = 0;
}

CMN.prototype.realtime = function(mfcc){
   
  this.framenum++;
  if (this.cmeanInitSet){
    // initial data exists
    for (var i = 0; i <this.veclen; i++){
      // accumulate current MFCC to sum
      this.mfcc_sum[i] += mfcc[i];
      // calculate mean
      // map (do_map = map_cmn = true by default)
      
      var mean = mfcc[i] + this.cweight*this.cmeanInit[i];
      var divisor = this.framenum + this.cweight;
      mean /= divisor;
      if (i < this.mfccDim)
        mfcc[i] -= mean;
    }
  } else {
    // no initial data
    for (var i = 0; i<this.veclen; i++){
      // accumulate current MFCC to sum
      this.mfcc_sum[i] += mfcc[i];
      // calculate current mean
      var mean = this.mfcc_sum[i] / this.framenum;
      // mean normalization
      if (i < this.mfccDim)
        mfcc[i] -= mean;
    }
  }
  
  return mfcc;
}

CMN.prototype.update = function(){
  
  if (this.framenum == 0) return;
  
  // compute cepstral mean from now and previous sums up to CPMAX frames
  for (var i = 0; i < this.veclen; i++) 
    this.cmeanInit[i] = this.mfcc_sum[i];
  var frames = this.framenum;
  for (var i = 0; i < this.clistNum; i++){
    for (var j = 0; j< this.veclen; j++) 
      this.cmeanInit[j] += this.clist[i].mfcc_sum[j];
    if (this.clist[i] === undefined)
      console.error("UNDEFINED", JSON.stringify(this.clist), i); 
    else
    frames += this.clist[i].framenum;
    if (frames >= this.cpMax) break;
  }
  for (var i = 0; i< this.veclen; i++)
    this.cmeanInit[i] /= frames;
  
  
  this.cmeanInitSet = true;
  
  // expand clist if necessary
  if (this.clistNum == this.clistMax && frames < this.cpMax){
    this.clistMax += this.cpStep;
    for (var i = this.clistNum; i < this.clistMax; i++){
      this.clist[i] = {};
      this.clist[i].mfcc_sum = [];
      this.clist[i].framenum = 0;
    }
  }
  
  // shift clist
  var tmp = this.clist.splice(0, this.clistMax-1);
  //console.log ("TMP", JSON.stringify(tmp));
  this.clist[0] = {mfcc_sum: [], framenum: 0};
  for (var i = 0; i < this.veclen; i++)
    this.clist[0].mfcc_sum[i] = this.mfcc_sum[i];
  
  this.clist[0].framenum = this.framenum;
  this.clist = this.clist.concat(tmp);
  //console.log ("CLIST", JSON.stringify(this.clist));
  if (this.clistNum < this.clistMax)
    this.clistNum++;

}