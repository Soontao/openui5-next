const {
  get,
  isEmpty,
  concat,
  filter,
  size,
  zipObject,
  map,
  min,
  split,
  lastIndexOf,
  join,
  slice
} = require("lodash");
const { readFileSync, existsSync } = require("fs");
const { warn } = require("console");
const { dirname, relative, join: pJoin } = require("path");
const { type } = require("os");

module.default = babel => {
  const { types: t } = babel;

  const isRelativeModuleImport = (m = "") => {
    return m.startsWith("./") || m.startsWith("../");
  };

  const getLatestSAPFolderAbsPath = filepath => {
    if (existsSync(pJoin(dirname(filepath), "sap"))) {
      return filepath;
    } else {
      const pathSequenses = split(filepath, "/");
      const lastSAPDIRIndex = lastIndexOf(pathSequenses, "sap");
      const latestSAPFolder = join(
        slice(pathSequenses, 0, lastSAPDIRIndex + 1),
        "/"
      );
      return latestSAPFolder;
    }
  };

  const mapObjectToClassBody = objectExpression => {
    if (!objectExpression) {
      throw new Error("must input an AST node");
    }
    if (objectExpression.type != "ObjectExpression") {
      throw new Error(
        `must input ObjectExpression node but input ${
          objectExpression.type
        } node`
      );
    }
    var classBodyItems = map(objectExpression.properties, prop => {
      switch (prop.value.type) {
        case "FunctionExpression":
          var funcExpression = prop.value;
          var methodType =
            prop.key.name == "constructor" ? "constructor" : "method";
          return t.classMethod(
            methodType,
            prop.key,
            funcExpression.params,
            funcExpression.body,
            false
          );
        default:
          return t.classProperty(prop.key, prop.value);
      }
    });
    return t.classBody(classBodyItems);
  };

  const visitor = {
    Program: {
      enter: path => {
        if (!path.state) {
          path.state = {};
        }
        path.state.ui5next = { inserts: [] };
      },
      exit: path => {
        var state = path.state.ui5next;
        if (!isEmpty(state.inserts)) {
          path.node.body = concat(path.node.body, state.inserts);
        }
      }
    },

    VariableDeclaration: {
      enter: path => {
        var node = path.node;

        // is Object.extend class expression
        if (
          get(node, "declarations[0].init.callee.property.name", "") == "extend"
        ) {
          var declaration = node.declarations[0];
          var superClassIndentifier = declaration.init.callee.object;
          var classNameIndentifier = declaration.id;
          var args = declaration.init.arguments;
          var prefix = `class ${classNameIndentifier.name} extends ${
            superClassIndentifier.name
          }`;
          var warnning = str => {
            warn(`${prefix}: ${str}`);
          };
          var replaced;
          var body;
          if (
            superClassIndentifier.name == "jQuery" ||
            superClassIndentifier.name == "jQueryDOM" ||
            superClassIndentifier.name == "$"
          ) {
            // ignore jQuery.extend
            return;
          }

          switch (size(args)) {
            case 1:
              body = args[0];
              break;
            case 2:
              body = args[1];
              break;
            default:
              warnning(`unsupported args size`);
              break;
          }

          if (!body) {
            warnning(`not have class body, so ignore it`);
          } else {
            switch (body.type) {
              case "ObjectExpression":
                replaced = t.classDeclaration(
                  classNameIndentifier,
                  superClassIndentifier,
                  mapObjectToClassBody(body),
                  []
                );
                break;
              case "Identifier":
                warnning(`not support convert because it extend an Identifier`);
                break;
              case "StringLiteral":
                //  ClientPropertyBinding.extend("sap.ui.model.xml.XMLPropertyBinding");
                replaced = t.classDeclaration(
                  classNameIndentifier,
                  superClassIndentifier,
                  t.classBody([]),
                  []
                );
                break;
              default:
                warnning(`unsupported expression ${body.type}`);
                break;
            }
          }

          if (!isEmpty(replaced)) {
            path.replaceWith(replaced);
          }
        }
      }
    },

    CallExpression: {
      exit: path => {
        var node = path.node;

        // is sap.ui.define call expression
        if (
          get(node, ["callee", "object", "object", "name"], "") == "sap" &&
          get(node, ["callee", "object", "property", "name"], "") == "ui" &&
          get(node, ["callee", "property", "name"], "") == "define"
        ) {
          var state = path.state.ui5next;
          var filepath = path.hub.file.opts.filename;
          // fix jquery.sap.xxx.js require path
          var relativePrefix =
            relative(filepath, getLatestSAPFolderAbsPath(filepath)).replace(
              /\\/g,
              "/"
            ) || ".";
          var args = node.arguments || [];
          var imports = [];
          var definationFunction;

          args.forEach(arg => {
            switch (arg.type) {
              case "FunctionExpression":
                definationFunction = arg;
                break;
              case "ArrayExpression":
                imports = arg.elements;
                break;
              default:
                break;
            }
          });

          if (definationFunction) {
            var definationFunctionParams = definationFunction.params;

            var expresions = definationFunction.body.body; // is array

            if (!isEmpty(expresions)) {
              // convert to require
              if (!isEmpty(imports)) {
                // add require expressions
                var requireExpressions = [];
                for (
                  let index = 0;
                  index < min([size(imports), size(definationFunctionParams)]);
                  index++
                ) {
                  const id = definationFunctionParams[index];
                  const mName = imports[index];
                  // if not relative module improt, convert to relative
                  if (!isRelativeModuleImport(mName.value)) {
                    mName.value = `${relativePrefix}/${mName.value}`;
                  }
                  requireExpressions.push(
                    t.importDeclaration([t.importDefaultSpecifier(id)], mName) // es6 import
                  );
                }

                expresions = concat(requireExpressions, expresions);
              }

              // >> return Module > export default Module

              var rtStatemnets = filter(expresions, {
                type: "ReturnStatement"
              });

              var expresions = filter(
                expresions,
                e => e.type !== "ReturnStatement"
              );

              if (size(rtStatemnets) > 1) {
                warn(
                  `file: ${filepath}, have more than one return statements in sap.ui.deinfe, please process it manual.`
                );
                return;
              }

              if (size(rtStatemnets) == 1) {
                expresions = concat(
                  expresions,
                  t.exportDefaultDeclaration(rtStatemnets[0].argument)
                );
              }

              // << return Module > export default Module

              state.inserts = concat(state.inserts, expresions);
              path.remove();
            } else {
            }
          } else {
          }
        }
      }
    }
  };
  return {
    visitor: visitor
  };
};

module.exports = module.default;
