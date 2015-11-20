var _ = require('underscore'),
    Q = require('q'),
    fs = require('fs'),
    moment = require('moment'),
    readFile = Q.nfbind(fs.readFile),
    Parser = require('css-selector-parser').CssSelectorParser,
    cheerio = require('cheerio'),
    util = require('util'),
    Class = require('class.extend'),
    Grep = require('./lib/Grep');

function addRule(list, rule) {
   if (!rule || rule.type !== 'rule') {
      return list;
   }

   var toAdd = _.clone(rule);
   delete(toAdd.rule);
   list.push(toAdd);

   return addRule(list, rule.rule);
}

function flattenSelectors(rule) {
   return addRule([], rule);
}

function selectorSorter(rule) {
   if (rule.id) {
      // ID-based rules are more likely to be distinctive, so weight them higher
      return (rule.id.length * 3);
   } else if (rule.classNames) {
      // the more classnames there are, and the longer they are, the more we weight them
      var val, weight;

      val = _.reduce(rule.classNames, function(val, cls) {
         return val + cls.length;
      }, 0);

      weight = (Math.log(rule.classNames.length) + 1);

      return val * weight;
   } else if (rule.tagName) {
      return Math.log(rule.tagName.length) + 1;
   }

   return 0;
}

function toRegularExpression(rule) {
   if (rule.id) {
      // TODO: once we have escaping in Grep, do something like:
      // return 'id=[\'"]' + rule.id + '[\'"]';
      return rule.id;
   } else if (rule.classNames) {
      // TODO: this probably isn't very cross-platform:
      return '\\(' + rule.classNames.join('\\|') + '\\)';
   }

   // TODO: right now we don't even grep for tag names that are four or less
   // characters to eliminate a lot of useless searches like "a", "span", "div", etc
   return (rule.tagName && rule.tagName.length > 4) ? ('<' + rule.tagName) : false;
}

function pathContainsSelector(path, selector) {
   console.log('Does "%s" contain "%s"', path, selector);
   return readFile(path)
      .then(function(contents) {
         return cheerio.load(contents);
      })
      .then(function($) {
         return $(selector).length > 0;
      });
}

function findFilesToTest(path, selector) {
   var parser = new Parser(),
       topRule = parser.parse(selector),
       def = Q.defer();

   if (!topRule || topRule.type !== 'ruleSet' || selector.indexOf('"') !== -1 || selector.indexOf("'") !== -1) {
      throw new Error(util.format('invalid selector "%s"', selector, topRule));
   }

   /*
   console.log('selector "%s" in directory "%s"', selector, this._directory);
   console.log(util.inspect(parser.parse(selector), { depth: null }));
   */

   function lookForSelector(prevPromise, filePath) {
      return prevPromise
         .then(function(matchingPaths) {
            return pathContainsSelector(filePath, selector)
               .then(function(doesContain) {
                  if (doesContain) {
                     matchingPaths.push(filePath);
                  }
                  return matchingPaths;
               });
         });
   }

   _.chain(flattenSelectors(topRule.rule))
      .sortBy(function(r) {
         var v = selectorSorter(r);
         r.sortWeight = v;
         return v;
      })
      .reverse()
      .map(function(r) {
         var v = toRegularExpression(r);
         r.regex = v;
         return r;
      })
      .reduce(function(prev, rule) {
         return prev
            .then(function(paths) {
               if (rule.regex === false) {
                  return paths;
               }
               return Grep.search(rule.regex, paths);
            });
      }, Q([ path ]))
      .value()
      .then(function(grepPaths) {
         return _.reduce(grepPaths, lookForSelector, Q([]));
      })
      .then(function(results) {
         def.resolve(results);
      })
      .fail(function(err) {
         def.reject(err);
      });

   return def.promise;
}

module.exports = Class.extend({

   init: function(directory) {
      this._directory = directory;
      this._verifyDirectory();
   },

   _verifyDirectory: function() {
      var stats = fs.statSync(this._directory);

      if (!stats || !stats.isDirectory()) {
         throw new Error(util.format('Invalid directory "%s"', this._directory));
      }
   },

   search: function(selector) {
      var start = moment();
      return findFilesToTest(this._directory, selector)
         .then(function(paths) {
            return {
               time: moment.duration(moment().diff(start)),
               paths: paths,
            };
         });
   },

});
