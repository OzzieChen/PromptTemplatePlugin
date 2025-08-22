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
	const staging = path.join(root, `.staging-edge-${Date.now()}`);
	const out = path.join(dist, `edge-prompt-templates-v${version}.zip`);
	if(!fs.existsSync(dist)) fs.mkdirSync(dist);
	try{
		if(fs.existsSync(staging)) fs.rmSync(staging, { recursive:true, force:true });
		fs.mkdirSync(staging);
		// copy to staging
		execFileSync('cp', ['-a', 'edge-prompt-templates/.', staging], { cwd: root });
		// touch all files/dirs to current time
		execFileSync('find', ['.', '-exec', 'touch', '{}', '+'], { cwd: staging });
		// zip staging content as root folder edge-prompt-templates
		if(fs.existsSync(out)) fs.rmSync(out);
		execFileSync('zip', ['-r', out, '.'], { stdio: 'inherit', cwd: staging });
		console.log('Created', out);
	} catch(e){
		console.error('zip failed:', e.message);
		process.exit(1);
	} finally {
		try{ fs.rmSync(staging, { recursive:true, force:true }); }catch(e){}
	}
}

zip();