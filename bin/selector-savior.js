var program = require('commander'),
    Savior = require('../src/index'),
    pkg = require('../package.json'),
    savior;

program
   .version(pkg.version)
   .option('-d, --directory [path]', 'Directory to search')
   .option('-s, --selector [value]', 'Selector to use for search')
   .parse(process.argv);

if (!program.directory) {
   console.log('ERROR: you must specify a directory to search');
   process.exit(-1);
} else if (!program.selector) {
   console.log('ERROR: you must specify a selector to use for your search');
   process.exit(-1);
}

savior = new Savior(program.directory);
savior.search(program.selector)
   .then(function(results) {
      console.log('%d matching paths found in %s', results.paths.length, results.time.humanize());
      console.log(results.paths);
   })
   .done();
