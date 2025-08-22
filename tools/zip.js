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
	const dist = path.join(root, 'dist');
	const out = path.join(dist, `edge-prompt-templates-v${version}.zip`);
	// prepare dist folder
	if(!fs.existsSync(dist)) fs.mkdirSync(dist);
	// zip the edge-prompt-templates folder directly into dist
	try{
		if(fs.existsSync(out)) fs.rmSync(out);
		execFileSync('zip', ['-r', out, 'edge-prompt-templates'], { stdio: 'inherit', cwd: root });
		console.log('Created', out);
	}catch(e){
		console.error('zip failed:', e.message);
		process.exit(1);
	}
}

zip();