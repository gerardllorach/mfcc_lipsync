//@MFCC GUI

// Globals
if (!LS.Globals)
  LS.Globals = {};


// ------------------ GUI ------------------

this.onRenderGUI = function(){
  if (!LS.Globals.MFCC)
    return;
  
  var MFCC = LS.Globals.MFCC;
  
  width = gl.viewport_data[2];
  height = gl.viewport_data[3];
  
  gl.start2D();
  
  // Filter banks
  var filterBanks = MFCC.filterBanks;
  var nfft = 512;
  gl.translate(40,50);
  if (filterBanks){
    for (var i = 0; i<filterBanks.length; i++){
      gl.beginPath();
      // Draw lines
      gl.moveTo(0,0);
      for (var j = 0; j<nfft; j++)
        gl.lineTo(j * 512/nfft, -filterBanks[i][j]*20);
      
      gl.strokeStyle = "rgba(255,255,255,0.9)";
      gl.stroke();
    }
  }
  gl.translate(-40,-50);
  
  
  // FFT
  var data = MFCC.data;
  if (data){
    gl.beginPath();
    gl.translate(40,100);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<nfft; i++)
      gl.lineTo(i * 512/nfft, -45 - (data[i]+20)/1.4);
    
    gl.strokeStyle = "rgba(255,255,255,0.9)";
    gl.stroke();

    gl.translate(-40,-100);
  }
  
  
  // Power Spectrogram
  var powerSpec = MFCC.powerSpec;
  if (powerSpec){
    gl.beginPath();
    gl.translate(40,100);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<nfft; i++)
      gl.lineTo(i * 512/nfft, -powerSpec[i]*1);
    
    gl.strokeStyle = "rgba(127,255,127,0.9)";
    gl.stroke();

    gl.translate(-40,-100);
  }
  
  
  // Wave
  var wave = MFCC.wave;
  if (wave){
    gl.beginPath();
    gl.translate(40,200);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<wave.length; i++)
      gl.lineTo(i *0.5, wave[i]*100);
    
    gl.strokeStyle = "rgba(255,255,255,0.9)";
    gl.stroke();

    gl.translate(-40,-200);
  }
  
  
  // MFCC visualization
  // max mfcc ~= 32 / training = 18 (not CMN)
  // max delta ~= 8 / training = 5
  // max energy ~= 5 / training = 2 (not CMN)
  var prevMFCC = MFCC.prevMFCC;
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
      
    	gl.translate(-40,-300);
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
        for (var i = 0; i<keys.length; i++){
          var prob = LS.Globals.gmm.phonemeP[keys[i]];
          // Confidence
          var alpha = (prob.conf-1)/2;
          gl.fillStyle = "rgba(255,255,255,"+ alpha +")";
          gl.beginPath();
          gl.arc(width-20, -hIncr/4 + hIncr*5 + i*hIncr, 5, 0, 2 * Math.PI);
          gl.fill();
          // Phoneme
          gl.fillStyle = "rgba(255,255,255,0.8)";
          gl.fillText(keys[i],width -40, hIncr*5 + i*hIncr);
          // Probability - Value preparation
          alpha = (prob.prob + 20)/(-10-20);
          gl.fillStyle = "rgba(255,255,255,0.8)";//"+alpha+")";
          gl.fillRect(
            width - 50,-hIncr/2 +hIncr*5 + i*hIncr,
            prob.prob*1,hIncr/2);
          
        }
        // Result
        gl.font = "15px Arial";
        gl.fillStyle = "rgba(255,255,255,0.8)";
        if (LS.Globals.gmm.confidence !== undefined)
        	gl.fillText("Result: "+ LS.Globals.gmm.result + 
                    "; CM: "+ LS.Globals.gmm.confidence.toFixed(2)+
                    "; " + LS.Globals.gmm.resultLow,
                    width -250, height*0.95);
        
      }
    }
  }
  
  
  
  
  gl.finish2D();
}