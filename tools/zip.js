const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function readVersion(){
  const mfPath = path.resolve(__dirname, '..', 'edge-prompt-templates', 'manifest.json');
  const json = JSON.parse(fs.readFileSync(mfPath, 'utf-8'));
  return json.version || '0.0.0';
}

function zip(){
  const version = readVersion();
  const root = path.resolve(__dirname, '..');
  const folder = path.join(root, `edge-prompt-templates-v${version}`);
  const out = path.join(root, `edge-prompt-templates-v${version}.zip`);
  // prepare folder
  if(fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
  fs.cpSync(path.join(root, 'edge-prompt-templates'), folder, { recursive: true });
  if(!fs.existsSync(path.join(folder, 'manifest.json'))){
    console.error('manifest.json missing in versioned folder');
    process.exit(1);
  }
  // zip the versioned folder
  try{
    if(fs.existsSync(out)) fs.rmSync(out);
    execFileSync('zip', ['-r', out, path.basename(folder)], { stdio: 'inherit', cwd: root });
    console.log('Created', out);
  }catch(e){
    console.error('zip failed:', e.message);
    process.exit(1);
  }
}

zip();