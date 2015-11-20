var _ = require('underscore'),
    Q = require('q'),
    util = require('util'),
    cp = require('child_process');

module.exports = {

   search: function(regex, paths) {
      console.log('grep for "%s" in', regex, paths);
      // TODO: make this not shell out to an external dependency if we can find
      //       a sufficiently-fast node-native implementation of Boyer-Moore, etc
      // TODO: make this so that paths are escaped or don't need to be
      // TODO: need to limit the number of paths passed as args
      var cmd = util.format('grep -lir "%s" %s', regex, paths.join(' ')),
          def = Q.defer();

      cp.exec(cmd, {}, function(err, stdout, stderr) {
         // TODO: better handling of response "parsing"
         def.resolve(stdout.trim().split('\n'));
      });

      return def.promise;
   },

};
