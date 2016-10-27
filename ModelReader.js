//@Model Reader

// Reads phoneme model jnas-mono-16mix-gid.hmmdefs

var URL = "https://webglstudio.org/latest/fileserver/files//gerard/MFCCs%20lipsync/jnas-mono-16mix-gid.hmmdefs";

this.onStart = function(){
	var m = new Model();

}

function Model(){
  
  this.model = {};
  
  this.init();
  
}


Model.prototype.init = function(){
  this.read(URL);
}

Model.prototype.read = function(url){
  
  var that = this;
	var req = new XMLHttpRequest();
	
	req.open('GET', url, true);
	//xhr.responseType = "arraybuffer";
  
  req.onload = function()
	{
		var response = this.response;
		if(this.status < 200 || this.status >= 300)
			return console.error("File not found: ", this.status);
		that.parse(this.response);
		
    console.log("Finised loading and parsing.");
    
		return;
	}
  
  req.addEventListener("progress", function(e){
    var progress = e.loaded/e.total;
    console.log("Progress: ", progress);
  });
  
  req.send();
}


Model.prototype.parse = function(data){
  // Each new phoneme starts with ~h
  var phonemeData = data.split("~h");
  phonemeData.shift();
  phonemeData.shift();
  
  // There are 42 phonemes (approx?)
  for (var i = 0; i<phonemeData.length; i++){
    
    // The name of the phoneme is inside quotation marks
    var tmp = phonemeData[i].split('\"');
    var phoneme = tmp[1];
    
    this.model[phoneme] = [];

    // Each letter has 3 states. Each state has 16 GMM (mixture, mean, variance). 48 GMM in total.
    var phonemeContent = tmp[2];
   
		// One state only (0 is discarded)
		var stateContent = phonemeContent.split("<STATE>")[1];
    // 16 mixtures
    
    var mixContent = stateContent.split("<MIXTURE>");
		mixContent.shift(); // First part is not a mixture

    for (var j = 0; j<mixContent.length; j++){
      var mix = {};
      var mixData = mixContent[j].split("\n");
      mix.mixture = parseFloat(mixData[0].split(" ")[1]);
      mix.mean = mixData[2].split(" ");
      mix.mean.shift();
      mix.variance = mixData[4].split(" ");
      mix.variance.shift();
      for (var k = 0; k < mix.mean.length; k++){
        mix.mean[k] = parseFloat(mix.mean[k]);
        mix.variance[k] = parseFloat(mix.variance[k]);
      }
      mix.gconst = parseFloat(mixData[5].split(" ")[1]);
      
      this.model[phoneme].push(mix);
    }
    
    
  }

	//console.log(this.model);


}