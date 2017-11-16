/* eslint-env jest */
const { promisify } = require('util');
const gitIgnore = require('gitignore-globs');
const glob = promisify(require('glob'));

test('glob ignores gitignore', async () => {
  let ignore = [];
  try {
    ignore = gitIgnore();
  } catch (e) {}

  const files = await glob('**/*.{js,json,css,html,md}', {
    ignore: ignore.concat(['__tests__/**']),
    nodir: true,
  });

  expect(files.toString()).not.toMatch('node_modules');
});
