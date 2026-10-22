// Runs before npm start / build / test. Written in old-style JavaScript on purpose,
// so even a very old Node can run it and explain what to do.
var major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 18) {
  console.error('\n  Node.js ' + process.versions.node + ' is too old for the website: it needs Node 18 or newer (20 recommended).');
  console.error('  Install Node 20 with nvm (no sudo needed):');
  console.error('    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash');
  console.error('    source ~/.bashrc');
  console.error('    nvm install 20');
  console.error('  Then, in web:  rm -rf node_modules package-lock.json && npm install\n');
  process.exit(1);
}
