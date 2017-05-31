import esprima from 'esprima';
import Promise from 'bluebird';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import { join } from 'path';
import fs from 'fs';

const filesToCopy = ['util.js', 'errors.js', 'proto-def.js'];

const input = join('node_modules', 'rethinkdb')
const output = 'lib';

const isVar = name => node => (
  node.type === 'VariableDeclarator' &&
  node.id.name === name
);

const isAssignment = name => node => (
  node.type === 'AssignmentExpression' &&
  node.left.name === name
);


// Remove Net
const isNetVariableDeclaration = isVar('net');
const isNetAssignment = isAssignment('net');

const isTermBase$Run = node => (
  node.type === 'AssignmentExpression' &&
  node.left.type === 'MemberExpression' &&
  node.left.object.type === 'MemberExpression' &&
  node.left.object.object.name === 'TermBase' &&
  node.left.object.property.name === 'prototype' &&
  node.left.property.type === 'Identifier' &&
  node.left.property.name === 'run'
);

// Remove Binary/Buffer
const isBinaryVariableDeclaration = isVar('Binary');
const isBinaryAssignment = isAssignment('Binary');

const isBufferTest = node => (
  node.type === 'BinaryExpression' &&
  node.operator === 'instanceof' &&
  node.left.name === 'val' &&
  node.right.name === 'Buffer'
);

const isBinaryHelperAssignemnt = node => (
  node.type === 'AssignmentExpression' &&
  node.left.type === 'MemberExpression' &&
  node.left.object.name === 'rethinkdb' &&
  node.left.property.name === 'binary'
);

const isReturnNewBinary = node => (
  node.type === 'ReturnStatement' &&
  node.argument.type === 'NewExpression' &&
  node.argument.callee.type === 'Identifier' &&
  node.argument.callee.name === 'Binary' &&
  node.argument.arguments[0].name === 'val'
);

// Remove Promise/Bluebird
const isPromiseDeclaration = isVar('Promise');
const isPromiseAssignment = isAssignment('Promise');

const cleanup = replacements => (node, meta) => {
  if (
    isNetVariableDeclaration(node) ||
    isNetAssignment(node) ||
    isTermBase$Run(node) ||
    isBinaryVariableDeclaration(node) ||
    isBinaryAssignment(node) ||
    isBinaryHelperAssignemnt(node) ||
    isPromiseDeclaration(node) ||
    isPromiseAssignment(node)
  ) {
    replacements.push([meta.start.offset, meta.end.offset + 1])
  } else if (isBufferTest(node)) {
    replacements.push([meta.start.offset, meta.end.offset, 'false'])
  } else if (isReturnNewBinary(node)) {
    replacements.push([meta.start.offset, meta.end.offset, 'throw new err.ReqlDriverCompileError("This should never happen.");'])
  }
}

async function rewriteAst() {
  const fileName = 'ast.js';
  const buffer = await Promise.promisify(fs.readFile)(join(input, fileName))
  const source = buffer.toString();

  const replacements = [];
  esprima.parse(source, {}, cleanup(replacements));

  let source2 = source;
  replacements
    .sort(([_1, a], [_2, b]) => b - a)
    .forEach(([a, b, repl = '']) => {
      source2 = source2.slice(0, a) + repl + source2.slice(b);
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
