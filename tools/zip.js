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
  const out = path.resolve(__dirname, `../edge-prompt-templates-v${version}.zip`);
  const src = path.resolve(__dirname, '..', 'edge-prompt-templates');
  // Use system zip if available
  try{
    execFileSync('zip', ['-r', out, 'edge-prompt-templates', '-x', 'edge-prompt-templates/.git/*', 'edge-prompt-templates/.DS_Store'], { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log('Created', out);
  }catch(e){
    console.error('zip failed:', e.message);
    process.exit(1);
  }
}

zip();