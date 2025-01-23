//@DEBUG
//defined: component, node, scene, globals

// Public variables
this.scale = 1;
this.scaleH = 1;

this.onStart = function()
{
  var url = "https://webglstudio.org/latest/fileserver/files//gerard/MFCCs%20lipsync/"
  
  //url += "mag_sp10_44100.txt";
  //url += "mag_500_700.txt";
  //url += "mag_pm_aeiou.txt";
  //url += "mag_100.txt";
  //url += "mag_chirp.txt"; 
  
  //url += "mag_sp10_44100.txt"; this.item = 'mag';
  
  //url += "fbe_sp10_44100.txt"; this.item = 'fbe';
  
  //url += "cc_sp10_44100.txt"; this.item = 'cc';
  
  url += "mfcc_sp10_44100.txt"; this.item = 'mfccLog';
  
  this.read(url, this.item);
}

this.onUpdate = function(dt)
{
	//node.scene.refresh();
}

this.onRenderGUI = function(){
  
  var globals = LS.Globals;
  if (!globals.MFCC || !globals.Matlab)
    return;
  
  if (!globals.MFCC.ended || !globals.Matlab.ready)
    return;
  
  var matlab = globals.Matlab;
  var mfcc = globals.MFCC;
  
  // Viewport
  var width = gl.viewport_data[2];
  var height = gl.viewport_data[3];
  
  gl.start2D();
  
  var translateX = 50;
  var translateY = height/2;
  gl.translate(translateX, translateY);
  
  // Scale
  var scale = this.scale;
  
  var time = LS.GlobalScene.time * 0.1;//getTime()*0.1;
  
  var item = this.item;
  // COMPARISON
	var step = 1;
  var numItems = 1;
  if (item == 'mag'){
    numItems = mfcc.fftSize/2;
    scale = this.scale * 0.001;
  } else if (item == 'fbe'){
    numItems = mfcc.numFilters;
    scale = this.scale * 0.0005;
  } else if (item == 'cc'){
    numItems = mfcc.mfccDim;
    scale = this.scale*5;
  } else if (item == 'mfccLog'){
    numItems = mfcc.mfccDim;
    scale = this.scale * 3;
  }
  
  step = this.scaleH * 0.8*width/numItems;
  
  
  var samples = mfcc.timestamp.length;
	// Find corresponding indices (mfcc is not uniformely sampled)
  var sInd = 0;
  var eInd = samples-1;
  time = time % mfcc.timestamp[samples-1];
  // Forward search (easier to implement and understand but bad performance)
  for (var i = 0; i<samples; i++){
    if (mfcc.timestamp[i]>time){
      eInd = i;
      sInd = Math.max(0, i-1);
      break;
    }
  }
  
  if (!mfcc[item]){gl.translate(-translateX, -translateY); return;}
  if (!mfcc[item][sInd]) {gl.translate(-translateX, -translateY); return;}
  if (!mfcc[item][sInd][0]) {gl.translate(-translateX, -translateY); return;}
  
  if (!matlab[item]){gl.translate(-translateX, -translateY); return;}
  if (!matlab[item][sInd]) {gl.translate(-translateX, -translateY); return;}
  if (!matlab[item][sInd][0]) {gl.translate(-translateX, -translateY); return;}
  
  
  
  // Paint MFCC
  gl.strokeStyle = "rgba(255,0,0,0.8)";
  gl.beginPath();
  gl.moveTo(0,0);
  var interWeight = (mfcc.timestamp[eInd] - time)/(mfcc.timestamp[eInd] - mfcc.timestamp[sInd]);
  for (var j = 0; j<numItems; j++){
    var interSample = mfcc[item][sInd][j] * interWeight + mfcc[item][eInd][j] * (1-interWeight);
    gl.lineTo(j*step, -interSample*scale);
  }
  gl.stroke();


  var translateY2 = 000;
  gl.translate(0,translateY2);

  samples = matlab.timestamp.length;
  // Forward search (easier to implement and understand but bad performance)
  for (var i = 0; i<samples; i++){
    if (matlab.timestamp[i]>time){
      eInd = i;
      sInd = Math.max(0, i-1);
      break;
    }
  }
  
  // Paint Matlab
  gl.strokeStyle = "rgba(0,255,0,0.5)";
  gl.beginPath();
  gl.moveTo(0,0);
  interWeight = (matlab.timestamp[eInd] - time)/(matlab.timestamp[eInd] - matlab.timestamp[sInd]);
  for (var j = 0; j<numItems; j++){
    interSample = matlab[item][sInd][j] * interWeight + matlab[item][eInd][j] * (1-interWeight);
    gl.lineTo(j*step, -interSample*scale);
  }
  gl.stroke();
  

  gl.translate(0,-translateY2);
  
  
  
  
  
  
  
  
  // Paint filter
  /*gl.strokeStyle = "rgba(255,255,255,0.5)";
  gl.beginPath();
  gl.moveTo(0,0);
  for (var i = 0; i<nfft/2; i++){
    gl.lineTo(i*step, -mfcc.h[i]*5000);
  }
  gl.stroke();
  */
  gl.translate(-translateX, -translateY);
  
  gl.finish2D();
}







this.read = function(url, opt){
  
  var that = this;
	var req = new XMLHttpRequest();
	
	req.open('GET', url, true);
  
  req.onload = function()
	{
		var response = this.response;
		if(this.status < 200 || this.status >= 300)
			return console.error("File not found: ", this.status);
    
    console.log("Finised loading.");
    if (opt == 'fbe')
			that.ready = that.parseFBE(this.response);
    else if (opt == 'cc')
      that.ready = that.parseCC(this.response);
    else if (opt == 'mag')
			that.ready = that.parse(this.response);
    else if (opt == 'mfccLog')
			that.ready = that.parseMFCC(this.response);
    else
      console.log ("ITEM not identified to load");
		return;
	}
  
  req.addEventListener("progress", function(e){
    //var progress = e.loaded/e.total;
    //console.log("Download progress: ", progress);
  });
  
  req.send();
}


this.parse = function(data){
  
  var str = data.split(/ +/);
  str.shift();
  var index = 0;
  var output = [];
  var timestamp = [];

  var fftSize = 2048; // HARDCODED
  
  for (var i = 0; i<str.length/fftSize; i++){
    output[i] = [];
    timestamp[i] = i*10*0.001 + 0.5*25*0.001;
  }
  
  for (var i = 0; i<fftSize/2; i++){
    for (var j = 0; j<str.length/fftSize; j++){
      output[j][i] = parseFloat(str[index]);
      index++;
    }
  }
  
  console.log("************** MAG", str.length/fftSize, "samples");
  
  LS.Globals.str = str;
  LS.Globals.Matlab = {};
  LS.Globals.Matlab.mag = output;
  LS.Globals.Matlab.timestamp = timestamp;
  LS.Globals.Matlab.ready = true;
  
  return true;
}


this.parseFBE = function(data){
    
  var str = data.split(/ +/);
  str.shift();
  var index = 0;
  var output = [];
  var timestamp = [];

  var nFilt = 20; // HARDCODED
  
  for (var i = 0; i<str.length/nFilt; i++){
    output[i] = [];
    timestamp[i] = i*10*0.001 + 0.5*25*0.001;
  }
  
  for (var i = 0; i<nFilt; i++){
    for (var j = 0; j<str.length/nFilt; j++){
      output[j][i] = parseFloat(str[index]);
      index++;
    }
  }
  
  console.log("************** FBE", str.length/nFilt, "samples");
  
  LS.Globals.str = str;
  LS.Globals.Matlab = {};
  LS.Globals.Matlab.fbe = output;
  LS.Globals.Matlab.timestamp = timestamp;
  LS.Globals.Matlab.ready = true;
  
  return true;
}


this.parseCC = function(data){
    
  var str = data.split(/ +/);
  str.shift();
  var index = 0;
  var output = [];
  var timestamp = [];

  var mfccDim = 12; // HARDCODED
  
  for (var i = 0; i<str.length/mfccDim; i++){
    output[i] = [];
    timestamp[i] = i*10*0.001 + 0.5*25*0.001;
  }
  
  for (var i = 0; i<mfccDim; i++){
    for (var j = 0; j<str.length/mfccDim; j++){
      output[j][i] = parseFloat(str[index]);
      index++;
    }
  }
  
  console.log("************** CC", str.length/mfccDim, "samples");
  
  LS.Globals.str = str;
  LS.Globals.Matlab = {};
  LS.Globals.Matlab.cc = output;
  LS.Globals.Matlab.timestamp = timestamp;
  LS.Globals.Matlab.ready = true;
  
  return true;
}

// PARSE MFCC
this.parseMFCC = function(data){
    
  var str = data.split(/ +/);
  str.shift();
  var index = 0;
  var output = [];
  var timestamp = [];

  var mfccDim = 12; // HARDCODED
  
  for (var i = 0; i<str.length/mfccDim; i++){
    output[i] = [];
    timestamp[i] = i*10*0.001 + 0.5*25*0.001;
  }
  
  for (var i = 0; i<mfccDim; i++){
    for (var j = 0; j<str.length/mfccDim; j++){
      output[j][i] = parseFloat(str[index]);
      index++;
    }
  }
  
  console.log("************** MFCC", str.length/mfccDim, "samples");
  
  LS.Globals.str = str;
  LS.Globals.Matlab = {};
  LS.Globals.Matlab.mfccLog = output;
  LS.Globals.Matlab.timestamp = timestamp;
  LS.Globals.Matlab.ready = true;
  
  return true;
}