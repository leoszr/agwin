// Smoke interativo do PTY dentro do artefato (Gate 3).
// Uso no AppImage final: ELECTRON_RUN_AS_NODE=1 ./AppImage pty-probe.cjs
// Uso em dev: node src/desktop/pty-probe.cjs
'use strict';
const { spawn } = require('node-pty');

function main() {
  const shell = process.env.SHELL || '/bin/sh';
  const pty = spawn(shell, ['-c', 'echo PTY_OK'], { cols: 80, rows: 24 });
  let output = '';
  pty.onData((data) => { output += data; });
  pty.onExit(() => {
    if (output.includes('PTY_OK')) {
      console.log('PTY_OK');
      process.exit(0);
    } else {
      console.error('PTY probe failed: PTY_OK not in output: ' + JSON.stringify(output));
      process.exit(1);
    }
  });
  setTimeout(() => {
    console.error('PTY probe timed out. Output so far: ' + JSON.stringify(output));
    process.exit(1);
  }, 8000).unref();
}

main();
