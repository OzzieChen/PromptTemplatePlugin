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
	const stagingParent = path.join(root, `.staging-edge-${Date.now()}`);
	const stagingDir = path.join(stagingParent, 'edge-prompt-templates');
	const out = path.join(dist, `edge-prompt-templates-v${version}.zip`);
	if(!fs.existsSync(dist)) fs.mkdirSync(dist);
	try{
		if(fs.existsSync(stagingParent)) fs.rmSync(stagingParent, { recursive:true, force:true });
		fs.mkdirSync(stagingParent);
		fs.mkdirSync(stagingDir, { recursive:true });
		execFileSync('cp', ['-a', path.join(root, 'edge-prompt-templates') + '/.', stagingDir], {});
		// touch directories first, then files, to current time
		execFileSync('find', ['edge-prompt-templates', '-type', 'd', '-exec', 'touch', '{}', '+'], { cwd: stagingParent });
		execFileSync('find', ['edge-prompt-templates', '-type', 'f', '-exec', 'touch', '{}', '+'], { cwd: stagingParent });
		if(fs.existsSync(out)) fs.rmSync(out);
		// -D: do not create directory entries (some unzip tools will assign current time to created dirs)
		execFileSync('zip', ['-r', '-D', out, 'edge-prompt-templates'], { stdio: 'inherit', cwd: stagingParent });
		console.log('Created', out);
	} catch(e){
		console.error('zip failed:', e.message);
		process.exit(1);
	} finally {
		try{ fs.rmSync(stagingParent, { recursive:true, force:true }); }catch(e){}
	}
}

zip();