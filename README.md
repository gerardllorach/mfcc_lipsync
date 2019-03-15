# WebGLStudio scene to visualize MFCCs

The code in this repository is meant for a WebGLStudio scene to visualize MFCCs in real-time with a microphone or some preloaded files. Drag and drop of your own audio files is also permitted. (https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Fgerard%2FMFCCs%20lipsync%2FmfccScene.scene.json). 

The code to compute MFCCs can be found in MFCCCalc.js. MFCCs are calculated following the directions from Julius (https://github.com/julius-speech/julius). Phoneme recognition is also implemeted using a GMM from Julius (ModelReader.js). 
