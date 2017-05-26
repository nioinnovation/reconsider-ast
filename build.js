import esprima from 'esprima';
import Promise from 'bluebird';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import { join } from 'path';
import fs from 'fs';

const filesToCopy = ['util.js', 'errors.js', 'proto-def.js'];

const input = join('node_modules', 'rethinkdb')
const output = 'lib';

const removeNetReferences = replacements => (node, meta) => {
  if (
    node.type === 'VariableDeclarator' &&
    node.id.name === 'net'
  ) {
    // Remove variable declaration
    replacements.push([meta.start.offset, meta.end.offset + 1])
  } else if (
    // remove assignment
    node.type === 'AssignmentExpression' &&
    node.left.name === 'net'
  ){
    replacements.push([meta.start.offset, meta.end.offset + 1])
  } else if (
    // remove usage on TermBase.prototype.run()
    node.type === 'AssignmentExpression' &&
    node.left.type === 'MemberExpression' &&
    node.left.object.type === 'MemberExpression' &&
    node.left.object.object.name === 'TermBase' &&
    node.left.object.property.name === 'prototype' &&
    node.left.property.type === 'Identifier' &&
    node.left.property.name === 'run'
  ) {
    replacements.push([meta.start.offset, meta.end.offset + 1])
  }
}

async function rewriteAst() {
  const fileName = 'ast.js';
  const buffer = await Promise.promisify(fs.readFile)(join(input, fileName))
  const source = buffer.toString();

  const replacements = [];
  esprima.parse(source, {}, removeNetReferences(replacements));

  let source2 = source;
  replacements
    .sort(([_1, a], [_2, b]) => b - a)
    .forEach(([a, b]) => {
      source2 = source2.slice(0, a) + source2.slice(b);
    });

  return Promise.promisify(fs.writeFile)(join(output, fileName), source2);
}

(async () => {
  try {
    await Promise.promisify(rimraf)(output);
    await Promise.promisify(mkdirp)(output);

    const copies = filesToCopy
      .map(fn => ({
        source: join(input, fn),
        target: join(output, fn),
      }))
      .map(({ source, target }) => (
        new Promise((done, err) => {
          const read = fs.createReadStream(source);
          const write = fs.createWriteStream(target);
          read.on('error', err);
          write.on('error', err);
          write.on('close', done);
          read.pipe(write);
        })
      ));

    await Promise.all([...copies, rewriteAst()]);
  } catch(err) {
    console.error(err);
  }
})();
