const {rmSync} = require('node:fs') as typeof import('node:fs');

for (const directory of process.argv.slice(2)) {
 if (directory !== 'lib' && directory !== '.test-build') throw new Error(`Unexpected output directory: ${directory}`);
 rmSync(directory, {recursive: true, force: true});
}
