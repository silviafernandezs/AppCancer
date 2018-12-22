var fs = require('fs');
var fse = require('fs-extra');
var _ = require('lodash');
var server = require('./server');
var readline = require('readline');

var ds = server.dataSources.mysqlDs;

var database = _.get(ds, 'settings.database');

if (database) {

  var rl = readline.createInterface(process.stdin, process.stdout);
  rl.setPrompt('Enter table name > ');
  rl.prompt();
  rl.on('line', function(table) {
    ds.discoverModelDefinitions({
      all: true,
      associations: true,
      owner: database,
      type: 'table'
    }, function(err, models) {
      var temp = _.find(models, {
        name: table
      });

      if (temp) {
        rl.close();

        var rl1 = readline.createInterface(process.stdin, process.stdout);
        rl1.setPrompt('Table "' + table + '" has been found, if the JSON file exists will be overwritten, are you sure? Yes (y)  No (n): ');
        rl1.prompt();
        rl1.on('line', function(confirm) {

          var modelName = _.upperFirst(_.camelCase(table));
          var jsScriptContent = '"use strict";\n\nmodule.exports = function(' + modelName + ') {\n\n};\n\n';

          var jsonScriptContent = {
            "name": modelName,
            "base": "PersistedModel",
            "idInjection": false,
            "options": {
              "validateUpsert": true
            },
            "mysql": {
              "schema": database,
              "table": table
            }
          };

          if (confirm == 'y' || confirm == 'Yes') {

            ds.discoverSchema(table, function(err, resp) {

              _.forEach(resp.properties, function(v, k) {
                if (k == 'id') {
                  v.required = false;
                }
              });

              _.assign(jsonScriptContent, {
                properties: resp.properties,
                validations: [],
                relations: {},
                acls: [],
                methods: {}
              });

              var jsFilePath = './common/models/' + _.kebabCase(table) + '.js';
              fs.access(jsFilePath, function(err) {

                if (err) {
                  fs.writeFileSync(jsFilePath, jsScriptContent);
                }

                fs.readFile('./server/model-config.json', "utf8", (err, resp) => {

                  var jsonData = JSON.parse(resp);

                  if (!jsonData[modelName]) {
                    jsonData[modelName] = {
                      "dataSource": "mysqlDs",
                      "public": true
                    };

                    fs.writeFileSync('./server/model-config.json', JSON.stringify(jsonData, null, 2));
                  }

                  fs.writeFile('./common/models/' + _.kebabCase(table) + '.json', JSON.stringify(jsonScriptContent, null, 2), function(err) {
                    if (err) {
                      rl1.close();
                    } else {
                      console.log("Operation CWAL complete!");
                      rl1.close();
                    }
                  });

                });

              });
            });

          } else {
            console.log('bye!');
            rl1.close();
          }

        }).on('close', function() {
          process.exit(0);
        });

      } else {
        console.log('invalid table');
        rl.prompt();
      }

    });

  });
} else {
  console.log('invalid dataSource');
  process.exit(0);
}
