# Gina: A Glitch CLI

1. Anon user (or token from existing account) `POST https://api.glitch.com/users/anon` => JSON { persistentToken }
2. Create a project: `POST https://api.glitch.com/projects?authorization=${ persistentToken }` => JSON { id, name }
3. Create secure socket: `wss://api.glitch.com/hushed-frog/ot?token=${ persistentToken }`

## Installation & usage

Via npm to install the `gina` command line tool:

```bash
npm install --gobal @remy/gina
```

Now from inside a node project:

```bash
gina
```

This will take a few minutes depending on the size and complexity of the project. By default the user will be anonymous. To assign to your own Glitch account, find your

## Connecting to your Glitch account

You'll need your Glitch token. There's a few ways to get this, but it's not super easy. I recommend using Chrome and opening the developer tools.

Head to [glitch.com](https://glitch.com) and sign in. From the developer tools' console panel, run the following code:

```js
JSON.parse(localStorage.cachedUser).persistentToken
```

This should print a string that looks like a series of letters and numbers separated by dashes.

You can use the token on the command line like this:

```bash
GLITCH_TOKEN=xxxxx-xxxx-xxxx-xxxxx gina
```

Or you can add it to your terminal profile by adding the following line to your `.bashrc` (or `.profile` or whichever file you use):

```bash
GLITCH_TOKEN=xxxxx-xxxx-xxxx-xxxxx
```

Then run the `source` command on that file (`.bashrc` or which file you edited), like this:

```bash
source /Users/remy/.bashrc
```

Now you can run `gina` without the token defined (as above).

## Internals

### WebSocket API

#### init

```json
{"command":"broadcast","message":{"user":{"avatarUrl":null,"awaitingInvite":false,"id":553215,"name":null,"login":null,"color":"#80f289","utcOffset":0,"branchName":"Live","readOnly":false,"thanksReceived":false,"tabId":"49017","projectPermission":{"userId":0000,"projectId":"55d4fb6f-gggg-4a70-a214-292ba452bbb2","accessLevel":30},"invited":false,"left":false,"stopAsking":false}}}
```

Documents down:

```json
[{"response_type":"document","id":"15107826537bca4ee0-e18c-gggg-99fa-fa696c5c7e86","path":"server.js","content":...","version":1,"broadcast":{}}]
```

#### Delete file

```json
{"command":"document","id":"15107826534933af4b-c5f0-4b06-gggg-a7aacb923b97","path":""}
```

Delete all the files:

```js
const path = '';
files.filter(_ => _.path !== '.glitch-assets').map(({ id }) => {
  wss.send(JSON.stringify({
    command: "document",
    id,
    path // empty string deletes
  }))
})
```

#### Create file

```js
const path = "my-file.js";
const id = uuid.v4();
const document = { command: "document", id, path }
wss.send(JSON.stringify(document));

// then send contents via a transform
const submit = { id, "command":"submit","transform":{"position":0,"insert": contents ,"num_delete":0,"version":2} };
wss.send(JSON.stringify(submit));
```

## The name

I've decided to follow the UK weather system naming approach, in that they use names of women and men cycling their way through the alphabet. In my case, I'm taking the first letter from the project of interest, i.e. Glitch.

I'm kind on the bench about whether it works. I like that it's short and catchy, but I also have a niggle that it might be a bit weird. Ping me an issue if you think it needs changing (either offline via email or an open issue).

## TODO

- [ ] Asset files
- [ ] Detect package name and re-use
- [ ] Better error handling

## Licence

- [MIT](https://rem.mit-license.org) / https://rem.mit-license.org
