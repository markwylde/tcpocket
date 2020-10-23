const test = require('tape-catch');

const tester = (type) => (name, fn) => (test[type] || test)(name, fn);

const createTest = tester();
createTest.only = tester('only');
createTest.skip = tester('skip');

module.exports = createTest;
