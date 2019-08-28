//@MFCC GUI

// Globals
if (!LS.Globals)
  LS.Globals = {};


// ------------------ GUI ------------------

this.URLS = [];
this.logScale = false;

this.onStart = function(){
  this.URLS = [];
}

// Collect url names
this.onUpdate = function(){
  var control = LS.Globals.Control;
  if (control){
    if (this.URLS.length == 0 && control.URL){
      console.log("length ruls", control.URL.length);
      for (var i = 0; i< control.URL.length; i++){
        var u = control.URL[i].split("/");
        this.URLS[i] = u[u.length-1];
      }
      console.log(this.URLS);
    }
  }
}


if (!this.PauseText){this.PauseText = "Pause"}; 
this.onRenderGUI = function(){
  if (!LS.Globals.MFCC)
    return;
  
  var mfcc = LS.Globals.MFCC;
  if (!mfcc)
    return;
  
  if (!LS.Input.Mouse.left_button)
  	this._clicked = false;
  
  width = gl.viewport_data[2];
  height = gl.viewport_data[3];
  
  

  gl.start2D();

  // Filter banks
  var filterBanks = mfcc.filterBanks;
  var nfft = mfcc.analyser.frequencyBinCount;

  var scaleW = 0.5;

  gl.translate(40,50);
  if (filterBanks){
    for (var i = 0; i<filterBanks.length; i++){
      gl.beginPath();
      // Draw lines
      gl.moveTo(0,0);
      for (var j = 0; j<nfft; j++){
        // Log scaling
        if (!this.logScale)
        	gl.lineTo(j * scaleW, -filterBanks[i][j]*20);
        else{
          var xLogValue = ( 1/(Math.log(mfcc.fs/2)) ) * Math.log((j/nfft)*mfcc.fs/2+1);
          gl.lineTo(xLogValue * scaleW * nfft, -filterBanks[i][j]*20);
        }
      }

      gl.strokeStyle = "rgba(255,255,255,0.9)";
      gl.stroke();
    }
    // Show frequencies
    gl.font = "10px Arial";
    gl.fillStyle = "rgba(255,255,255,0.8)";
    gl.textAlign = "center";
    // Log scaling
    if (!this.logScale){
      // mhi
      gl.fillText(mfcc.highFreq+"Hz", mfcc.highFreq/(mfcc.fs*0.5) * nfft * scaleW, 15);
      // Half freq
      gl.fillText(mfcc.fs/4 + "Hz", (nfft/2)*scaleW, 15);
    } else {
      // lhi
      gl.fillText(mfcc.lowFreq+"Hz",( 1/(Math.log(mfcc.fs/2)) ) * Math.log(mfcc.lowFreq+1) * nfft * scaleW, 15);
    	// mhi
      gl.fillText(mfcc.highFreq+"Hz",( 1/(Math.log(mfcc.fs/2)) ) * Math.log(mfcc.highFreq) * nfft * scaleW, 15);
    }
    // Max freq
    gl.fillText(mfcc.fs/2 + "Hz", (nfft-1)*scaleW, 15);
    // Legend
    gl.fillText("Mel-scale Filter Banks", scaleW*nfft/1.5, -22);
  }
  gl.translate(-40,-50);


  // FFT
  var data = mfcc.data;
  if (data){
    gl.beginPath();
    gl.translate(40,100);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<nfft; i++){
      if (!this.logScale)
      	gl.lineTo(i * scaleW, -45 - (data[i]+20)/1.4);
      else {
        xLogValue = ( 1/(Math.log(mfcc.fs/2)) ) * Math.log((i/nfft)*mfcc.fs/2+1);
      	gl.lineTo(xLogValue * nfft * scaleW, -45 - (data[i]+20)/1.4);
      }
    }

    gl.strokeStyle = "rgba(255,255,255,0.9)";
    gl.stroke();

    gl.fillText("Short-term power spectogram",nfft*scaleW*0.8, -5);

    gl.translate(-40,-100);
  }


  // Power Spectrogram
  var powerSpec = mfcc.powerSpec;
  var scaleH = 4;//0.001;
  if (powerSpec){
    gl.beginPath();
    gl.translate(40,100);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<nfft; i++){
      if (!this.logScale)
      	gl.lineTo(i * scaleW, -powerSpec[i]*scaleH);
      else{
      	xLogValue = ( 1/(Math.log(mfcc.fs/2)) ) * Math.log((i/nfft)*mfcc.fs/2+1);
        gl.lineTo(xLogValue * nfft * scaleW, -powerSpec[i]*scaleH);
      }
    }

    gl.strokeStyle = "rgba(127,255,127,0.9)";
    gl.stroke();

    // Legend
    gl.fillStyle = "rgba(127,255,127,0.9)";
    gl.fillText("Filtered power spectogram",nfft*scaleW*0.8, 15);
    gl.fillStyle = "rgba(255,255,255,0.8)";

    gl.translate(-40,-100);
  }


  // Wave
  var wave = mfcc.wave;
  if (wave){
    gl.beginPath();
    gl.translate(40,200);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<wave.length; i++)
      gl.lineTo(i *0.5 * scaleW, wave[i]*100);

    gl.strokeStyle = "rgba(255,255,255,0.9)";
    gl.stroke();

    // Legend
    gl.fillText("Audio signal (temporal domain)", wave.length*0.58*scaleW, 3);

    gl.translate(-40,-200);
  }


  // MFCC visualization
  // max mfcc ~= 32 / training = 18 (not CMN)
  // max delta ~= 8 / training = 5
  // max energy ~= 5 / training = 2 (not CMN)
  var prevMFCC = mfcc.prevMFCC;
  if (prevMFCC){

    if (prevMFCC[0]){
      gl.translate(40,300);
      //console.log(prevMFCC);
      var rect = {x: 0, y: 0, w: 20, h: 20};

      for (var n = 0; n < prevMFCC.length; n++) {
        for (var i = 0; i < prevMFCC[n].length-1; i++){

          var hue = (-prevMFCC[n][i]*5 + 180) % 360;         
          gl.fillStyle = "hsla("+hue+", 100%, 50%, 0.5)";

          if (i == 12){
            hue = (-prevMFCC[n][i]*30 + 180) % 360;
            gl.fillStyle = "hsla("+hue+", 100%, 50%, 0.5)";
          }
          gl.fillRect(rect.x + n*rect.w, rect.y + i*rect.h, rect.w, rect.h);
        }
      }

      // Legend
      var legendW = 162;
      var xMove = 55;
      rect.y = rect.y + rect.h*(prevMFCC[0].length);
      gl.fillStyle = "rgba(127, 127, 127, 0.7)";
      gl.fillRect(rect.x+xMove-20, rect.y-5, legendW, rect.h*2);

      rect.h = 15;
      rect.w = 2;
      for (var i = 0; i < 60; i++){
        var hue = ( - (i-30)*5 + 180) % 360; 
        gl.fillStyle = "hsla("+hue+", 100%, 50%, 0.5)";
        gl.fillRect(xMove + rect.x + i * rect.w, rect.y , rect.w, rect.h);
      }
      gl.font = "10px Arial";
      gl.fillStyle = "rgba(255,255,255,0.8)";
      gl.textAlign = "center";
      gl.fillText("-30", xMove-5 + rect.x, rect.y + rect.h + 15);
      gl.fillText("0", xMove + 55 + rect.x, rect.y + rect.h+15);
      gl.fillText("30", xMove + 115 + rect.x, rect.y + rect.h+15);

      // Legend
      gl.fillText("MFCC coefficients", legendW, -5);

      gl.translate(-40,-300);
    }
  }

  // MFCC Visualization 2
  if (prevMFCC){
    if (prevMFCC[0]){
      // Translate
      gl.translate(width - 400, 350);

      var numSampl = prevMFCC.length;
      var rect = {x: 0, y: 0, w: 20, h: 2};
      // Paint as signal
      for (var n = prevMFCC.length-1; n >=0 ; n--) {
        for (var i = 0; i < prevMFCC[n].length-1; i++){       
          gl.fillStyle = "rgba(255,255,255,"+ Math.pow((numSampl-n)/numSampl, 2)+")";
          gl.fillRect(rect.x + i*rect.w, rect.y -prevMFCC[n][i]*4, rect.w, rect.h);
        }
      }
      // Paint x axis line
      gl.beginPath();
      // Draw lines
      gl.moveTo(0,0);
      gl.lineTo(numSampl*rect.w, 0);
      gl.strokeStyle = "rgba(255,255,255,0.8)";
      gl.stroke();

      gl.fillText("MFCC coefficients", -50, 4);

      // Translate back
      gl.translate(-width + 400, -350);
    }
  }




  // Probability visualization
  if (LS.Globals){
    if (LS.Globals.gmm){
      if (LS.Globals.gmm.ready){
        gl.font = "10px Arial";
        gl.textAlign = "rigth";
        var keys = Object.keys(LS.Globals.gmm.phonemeP);
        var hIncr = (height*0.8)/keys.length;
        keys.sort();
        for (var i = 0; i<keys.length; i++){
          var prob = LS.Globals.gmm.phonemeP[keys[i]];
          // Confidence
          if (keys[i] == LS.Globals.gmm.result){
            var alpha = LS.Globals.gmm.confidence;
            gl.fillStyle = "rgba(255,255,255,"+ alpha +")";
            gl.beginPath();
            gl.arc(width-20, -hIncr/4 + hIncr*5 + i*hIncr, 5, 0, 2 * Math.PI);
            gl.fill();
          }
          // Phoneme
          gl.fillStyle = "rgba(255,255,255,0.8)";
          gl.fillText(keys[i],width -40, hIncr*5 + i*hIncr);
          // Probability - Value preparation
          alpha = (prob.prob + 20)/(-10-20);
          gl.fillStyle = "rgba(255,255,255,0.8)";//"+alpha+")";
          var rescaleProb = prob.prob * 0.2;// - LS.Globals.gmm.maxProb;
          gl.fillRect(
            width - 50,-hIncr/2 +hIncr*5 + i*hIncr,
            rescaleProb*1,hIncr/2);

        }
        // Result
        gl.font = "15px Arial";
        gl.fillStyle = "rgba(255,255,255,0.8)";
        if (LS.Globals.gmm.confidence !== undefined)
          gl.fillText("Result: "+ LS.Globals.gmm.result + 
                      "; CM: "+ LS.Globals.gmm.confidence.toFixed(2),//+
                      //"; " + LS.Globals.gmm.resultLow,
                      width -250, height*0.95);

      }
    }
  }



  // Select audio file
  gl.textAlign = "center";
  if (!this.rect)
    this.rect = {x:0, y:0, w:0, h:20};
  var rect = this.rect;
  var spaceW = 20;
  var lineY = 0;
  for (var i = 0; i<this.URLS.length; i++){
    // X displacement
    if (i != 0) rect.x += gl.measureText(this.URLS[i-1]).width + spaceW;
    else rect.x = 0;
    // Y displacement and X correction
    if (Math.floor((rect.x + gl.measureText(this.URLS[i]).width)/width)>=1){
      lineY++;
      rect.x = 0;
    }
    rect.y = height - (rect.h*1.3)*lineY - rect.h;
    rect.w = gl.measureText(this.URLS[i]).width;

    if (LS.Input.Mouse.x < rect.x + rect.w && LS.Input.Mouse.x > rect.x &&
        height-LS.Input.Mouse.canvasy < rect.y + rect.h && height-LS.Input.Mouse.canvasy > rect.y){
      gl.fillStyle = "rgba(255,255,255,0.5)";

      if (LS.Input.Mouse.left_button  && !this._clicked){
        this._clicked = true;
        if (LS.Globals.Control)
          if (!LS.Globals.Control.loading)
            LS.Globals.Control.loadSample(LS.Globals.Control.URL[i]);
        gl.fillStyle = "rgba(127,255,127,0.8)";
      }
    } else
      gl.fillStyle = "rgba(255,255,255,0.3)";

    gl.fillRect(rect.x,rect.y,rect.w,rect.h);
    gl.fillStyle = "rgba(255,255,255,0.9)";
    gl.fillText(this.URLS[i], rect.x + (rect.w-spaceW*0.5)/2, rect.y +3*rect.h/4);
  }



  gl.finish2D();
  
  
  
  // LS.GUI
  // Microphone
  if( LS.GUI.Button( [width-(0.05*width + 90),60,90,18], "Microphone" ) )
    if (LS.Globals.Control)
      LS.Globals.Control.startMicrophone();
  // Pause
  if( LS.GUI.Button( [width-(0.05*width + 90),90,90,18], this.PauseText ) ){
    var audioCtx = LS.Globals.AContext;
    var thatGUI = this;
    if(audioCtx.state === 'running') {
      audioCtx.suspend().then(function() {thatGUI.PauseText = "Resume";});
    } else if(audioCtx.state === 'suspended') {
      audioCtx.resume().then(function() {thatGUI.PauseText = "Pause";});  
    }
  }
  // Drag and drop text
  LS.GUI.Label( [width-(0.05*width + 90),130, 10, 18], "an audio file.\nOr drag and drop" )
  // Github code
  if( LS.GUI.Button( [width-(0.05*width + 90),20,90,18], "Github" ) )
  	window.open('https://github.com/gerardllorach/mfcc_lipsync','_blank');
  
  
  // MFCC Options
  if (!LS.Globals.Control)
    return;
  var opts = LS.Globals.Control.opts;
  if (!LS.Globals.Control.opts)
    return;
  // Filterbank number
  LS.GUI.Label( [width-(0.05*width + 250),60, 100, 18], "Filterbank size");
  opts.fBankNum = Math.round(LS.GUI.HorizontalSlider( [width-(0.05*width + 250),80, 100, 18], opts.fBankNum, 8, 28, true ));
  // MFCC dimensions
  LS.GUI.Label( [width-(0.05*width + 250),20, 100, 18], "MFCC coefficients");
  opts.mfccDim = Math.round(LS.GUI.HorizontalSlider( [width-(0.05*width + 250),40, 100, 18], opts.mfccDim, 8, 16, true ));
  // Reset MFCC
  if( LS.GUI.Button( [width-(0.05*width + 250),100,100,18], "Apply changes" ) ){
  	LS.Globals.MFCC = new MFCC(LS.Globals.Control._analyser, opts);
    LS.Globals.MFCC.init(LS.Globals.AContext.sampleRate);
    LS.Globals.Control.MFCC = LS.Globals.MFCC; // This is all very ugly!!
  }
  // LogScale
  this.logScale = LS.GUI.Toggle( [width-(0.05*width + 250),130,100,18], this.logScale, "Log Scale" );
  

  /*
    // MFCC
  var opts = {};
  this.defineHTKdefault(opts);
  opts.mfccDim = this.mfccDim;
  this.MFCC = new MFCC(this._analyser, opts);
  
  LS.Globals.MFCC = this.MFCC;
  
  */
	/*
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
}*/


}