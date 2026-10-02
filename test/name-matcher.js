'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'windlass', 'index.html'), 'utf8');
const declaration = html.match(/^\s*const properWordIn = .*;$/m);
assert(declaration, 'properWordIn matcher should exist');
const matcher = declaration[0].trim().replace(/^const properWordIn = /, '').replace(/;$/, '');
const properWordIn = vm.runInNewContext('(' + matcher + ')', {
  escRe: (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
});

assert.strictEqual(properWordIn('I unpack the kit.', 'Kit'), false);
assert.strictEqual(properWordIn('I greet Kit.', 'Kit'), true);
console.log('proper-name matcher passed: ambiguous lowercase words do not match');
