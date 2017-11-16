#!/usr/bin/env node
//@_ts-check
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
require('@remy/envy');

const fs = require('fs');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const glob = promisify(require('glob'));
const gitIgnore = require('gitignore-globs');
const fetch = require('node-fetch');
const WebSocket = require('ws');
const uuid = require('uuid/v4');
const debug = require('debug')('gina');
let token = process.env.GLITCH_TOKEN;

const packageName =
  process.env.USER + '-' + require(process.cwd() + '/package.json').name;

const API = 'https://api.glitch.com';

async function getToken() {
  if (token) return token;

  const res = await fetch(`${API}/users/anon`, {
    method: 'POST',
  });
  const json = await res.json();
  return json.persistentToken; // prompt user to store the token
}

async function makeProject(token) {
  const res = await fetch(`${API}/projects?authorization=${token}`, {
    method: 'post',
  });
  return await res.json();
}

async function sleep(n) {
  return new Promise(resolve => setTimeout(() => resolve(), n));
}

async function connect(name, token) {
  const ws = new WebSocket(`wss://api.glitch.com/${name}/ot?token=${token}`, {
    origin: API,
  });
  debug('connecting to glitch...');
  return new Promise(resolve => {
    ws.onopen = () => {
      debug('connected');
      resolve(ws);
    };
    ws.onclose = () => {
      debug('closed glitch socket');
    };
    ws.onerror = e => {
      console.log('🛑  glitch socket broke: %s', e.message);
      debug(e);
      process.exit(1);
    };
  });
}

function once(socket, handler) {
  const listener = e => {
    socket.removeEventListener('message', listener);
    handler(e);
  };
  socket.addEventListener('message', listener);
}

async function getFiles(socket) {
  return new Promise(resolve => {
    once(socket, e => {
      resolve(JSON.parse(e.data).filter(_ => _.path !== '.glitch-assets'));
    });
  });
}

async function deleteFiles(socket, files) {
  return new Promise(resolve => {
    const commands = files.map(
      file => `{"command":"document","id":"${file.id}","path":""}`
    );

    debug('deleting original files');
    debug(files.map(_ => _.path).join('\n'));

    commands.forEach(command => socket.send(command));
    resolve();
  });
}

async function untilListening(name, token) {
  console.log(' ⏳  waiting for dependencies...');
  const socket = new WebSocket(
    `wss://api.glitch.com/${name}/logs?token=${token}`,
    {
      origin: API,
    }
  );
  return new Promise(resolve => {
    let state = 'waiting';
    socket.onopen = () => {
      socket.onmessage = e => {
        const data = JSON.parse(e.data);
        debug(' 👷 %s', data.text);

        if (state === 'waiting' && data.text === 'restart') {
          // send `npm run build`
          command(name, token, 'npm run build');
          state = 'build';
        }

        if (data.text === 'listening') {
          if (state === 'build') {
            state = 'done';
            console.log(' 💅  server ready');
            socket.close();
            resolve();
          }
        }
      };
    };
  });
}

async function command(name, token, command) {
  console.log(' 🏗️  running %s...', command);
  const ws = new WebSocket(
    `wss://api.glitch.com/${name}/console/${token}/wetty/socket.io/?EIO=3&transport=websocket`,
    {
      origin: API,
    }
  );
  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      let seenPrompt = 0;
      const handler = e => {
        let message = '';
        try {
          [, message] = JSON.parse(e.data);
        } catch (error) {
          try {
            [, message] = JSON.parse(e.data.substr(e.data.indexOf('[')));
          } catch (error2) {
            debug('🛑 %s', error2);
            return;
          }
        }
        if (message.endsWith('$ ')) {
          seenPrompt++;
          if (seenPrompt === 1) {
            debug('🏗️ sending install command');
            ws.send(`42["input", "${command}\\r"]`);
          } else {
            ws.removeEventListener('message', handler);
            ws.close();
            resolve();
          }
        } else {
          debug('👷 %s', message);
          // if (seenPrompt) process.stdout.write(message);
        }
      };
      ws.addEventListener('message', handler);
    };
    ws.onerror = e => reject(e);
  });
}

async function sendOne(socket, path) {
  const id = uuid();
  const document = { command: 'document', id, path };
  let insert = '// missing';
  try {
    insert = await readFile(path, 'utf8');
  } catch (e) {
    console.log(`❌  couldn't read ${path}`);
  }

  // then send contents via a transform
  const submit = {
    id,
    command: 'submit',
    transform: {
      position: 0,
      insert,
      num_delete: 0,
      version: 2,
    },
  };

  return new Promise(resolve => {
    once(socket, () => {
      debug('⬆️ %s', path);
      resolve();
    });

    debug('➡️ %s', path);
    socket.send(JSON.stringify(document));
    socket.send(JSON.stringify(submit));
  });
}

async function send(socket) {
  let ignore = [];
  try {
    ignore = gitIgnore();
  } catch (e) {}

  const files = await glob('**/*.{js,json,css,html,md}', {
    ignore: ignore.concat('__tests__/**'),
    nodir: true,
  });

  console.log(' ⬆️  uploading %s files', files.length);

  for (let file of files) {
    await sendOne(socket, file);
  }
}

async function touch(id, token) {
  debug('👉 touching');
  return await fetch(`${API}/projects/${id}/touch?authorization=${token}`, {
    method: 'PATCH',
  });
}

async function main() {
  const token = await getToken();
  const { id, name } = await makeProject(token);

  console.log(`\n 📝  https://glitch.com/edit/#!/${name}`);

  let socket = null;
  try {
    socket = await connect(name, token);
    const files = await getFiles(socket);
    await deleteFiles(socket, files);
    await send(socket);
    await touch(id, token);
    await untilListening(name, token);
  } catch (e) {
    console.log(e);
  }

  if (socket !== null) socket.close();
  console.log(` 🌍  https://${name}.glitch.me\n`);
}

main();
