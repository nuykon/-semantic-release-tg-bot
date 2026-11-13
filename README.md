# semantic-release-tg-bot

A TypeScript plugin for semantic-release that sends release notifications to Telegram.

**Zero runtime dependencies.** It uses Node.js HTTPS, TLS, filesystem access and native glob matching. TypeScript, `@types/node` and semantic-release tooling are development dependencies only. The published package contains CommonJS JavaScript and generated TypeScript declarations.

Requires **Node.js 22.20 or newer** and a semantic-release installation in the consuming project.

## Install

```sh
pnpm add --save-dev @nuykon/semantic-release-tg-bot
```

Configure the plugin in your semantic-release configuration:

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@nuykon/semantic-release-tg-bot",
      {
        "notifications": [
          {"chatIds": "TELEGRAM_CHAT_ID", "branch": "release/*.x"}
        ]
      }
    ]
  ]
}
```

## Environment

Set `TELEGRAM_BOT_TOKEN` to a token created with BotFather. Chat IDs may be strings, numbers or names of environment variables. Values are read from semantic-release's `context.env`.

The package name is selected from `packageName`, then `SEMANTIC_RELEASE_PACKAGE`, then `npm_package_name`.

### Proxy support

**You can specify a proxy** using the `TELEGRAM_BOT_PROXY` environment variable in the environment running semantic-release. The plugin reads it from `context.env`; no extra dependencies or plugin options are required.

```sh
# HTTP proxy
export TELEGRAM_BOT_PROXY='http://proxy.example:8080'

# Or an HTTPS proxy
export TELEGRAM_BOT_PROXY='https://proxy.example:8443'

# Or a proxy with authentication; URL-encode special characters in credentials
export TELEGRAM_BOT_PROXY='http://user:p%40ssword@proxy.example:8080'
```

In CI, configure `TELEGRAM_BOT_PROXY` as a protected environment variable, especially when it contains credentials. Leave it unset for a direct connection. The plugin does not automatically use `HTTP_PROXY`, `HTTPS_PROXY` or `ALL_PROXY`.

Both HTTP and HTTPS proxies use CONNECT. TLS certificates for the proxy and Telegram are validated. SOCKS proxies are unsupported. A 30-second deadline covers the request, tunnel setup and response; responses are limited to 1 MiB. Telegram HTTP and API errors fail the hook. Requests are not automatically retried, to avoid duplicate notifications.

## Sending a private message to a user

The same `chatIds` setting handles personal conversations, groups and channels. For a private conversation, use the user's numeric Telegram ID (the private chat ID), or an environment variable containing that ID:

```json
{
  "notifications": [
    {"chatIds": "TELEGRAM_USER_ID", "notifyOnFail": true}
  ]
}
```

For example, set `TELEGRAM_USER_ID=123456789`. A literal number or numeric string also works; multiple recipients can be supplied as an array.

The user must first open the bot and press **Start** or send it a message. Bots cannot initiate a conversation with an arbitrary user. A personal `@username` is not a valid recipient identifier for `sendMessage`; use a numeric ID. Channel usernames such as `@release_channel` are supported separately by Telegram. See the [Bot API](https://core.telegram.org/bots/api#sendmessage) and [bot introduction](https://core.telegram.org/bots#how-do-bots-work).

## Options

| Option | Description | Default |
| --- | --- | --- |
| `packageName` | Override the package name | Environment |
| `notifyOnSuccess` | Send successful-release notifications | `true` |
| `notifyOnFail` | Send failed-release notifications | `false` |
| `success` | Success message object | Version and release notes |
| `fail` | Failure message object | Error names, messages and stacks |
| `notifications` | Array of recipient configurations | Required |

Each notification supports `chatIds` (one ID or an array), optional `branch`, and overrides for `notifyOnSuccess`, `notifyOnFail`, `success` and `fail`. Empty messages are skipped. Failure notifications work even when `nextRelease` is unavailable.

Branch patterns follow Node.js `path.posix.matchesGlob`, including `release/*`, `release/**`, `{main,beta}` and `@(main|beta)`. A `*` does not cross `/`. This is not a promise of full micromatch compatibility; migrate and check complex existing patterns. See the [Node.js glob API](https://nodejs.org/api/path.html#pathmatchesglobpath-pattern).

## Messages and templates

An inline message contains `message`, optional `format` (`markdown` by default, or `html`) and optional `customData`:

```json
{
  "message": "**${packageName} v${nextRelease.version}** has been released!",
  "format": "markdown"
}
```

Both `${packageName}` and `{{ nextRelease.version }}` interpolate dotted property paths. Numeric segments such as `${commits.0.message}` are supported. Missing values become empty strings; `customData` overrides context values. Interpolation does not execute JavaScript or recursively interpret substituted values. It does not HTML-escape values: escape dynamic content in HTML messages when necessary.

Available context properties are `packageName`, `branch`, `lastRelease`, `nextRelease`, `commits` and `errors`. Errors are available to failure messages. The context shape is exported as `TemplateContext`.

For files, use `{"path": "./templates/release.html", "customData": {"title": "Release"}}`. Paths resolve from the working directory. A `.html` extension selects HTML; other extensions select MarkdownV2. File contents support the same interpolation and are sent as authored Telegram syntax, without Markdown conversion.

For loops, conditionals or computed values, use a message function in a TypeScript semantic-release configuration:

```ts
// release.config.ts
import type {TemplateContext} from '@nuykon/semantic-release-tg-bot';

export default {
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@nuykon/semantic-release-tg-bot', {
      success: {
        message: ({packageName, nextRelease}: TemplateContext) =>
          `**${packageName} v${nextRelease?.version ?? ''}**\n${nextRelease?.notes ?? ''}`,
      },
      notifications: [{chatIds: 'TELEGRAM_CHAT_ID'}],
    }],
  ],
};
```

Functions are synchronous and must return a string. Configuration and template files are trusted project inputs. Functions receive the same context merged with `customData`; their return value is not interpolated again.

## Markdown support

Inline Markdown supports a small release-note dialect:

- ATX headings, unordered lists, bold, italic and strikethrough.
- Inline code and fenced code blocks, with optional language names.
- Inline HTTP, HTTPS, `tg` and `mailto` links, including balanced parentheses in destinations.
- Telegram MarkdownV2 escaping of literal punctuation.
- Removal of `<small>` wrappers around release links.

This is not a full CommonMark/GFM parser. Tables, reference links, images, blockquotes, nested lists and other unsupported constructs are sent as escaped literal text or have simplified formatting. Prefer a Telegram HTML template for precise formatting. File Markdown templates must already contain valid Telegram MarkdownV2.

## Migrating from the previous plugin

This is a new package, `@nuykon/semantic-release-tg-bot`, starting at version 1.0.0. When migrating from the previous `@nuykon/semantic-release-telegram-bot` package, account for these compatibility changes:

1. Upgrade Node.js to 22.20 or newer.
2. Replace Lodash and Nunjucks expressions, filters, loops and includes with simple dotted placeholders or a message function. Control tags and unsupported expressions fail with an explicit error.
3. Check branch filters against Node.js native glob semantics.
4. Check release-note formatting against the Markdown subset above, or supply an HTML message/template.
5. Use values from `context.env` when invoking hooks directly in tests or integrations.

The project remains TypeScript. Maintained by [Sergey Levchenko (nuykon)](https://github.com/nuykon). No dependency on semantic-release is installed by this package; it is a plugin for the release tool already installed in the consuming project.

## Development

All project code is TypeScript: the plugin, tests, cleanup script and release configuration. Tests use Node.js's built-in test runner and are compiled with strict type checking before execution. JSON manifests, TypeScript settings and YAML CI/lockfiles keep their native data formats.

Use **pnpm 11.0.7**, pinned by `packageManager` in `package.json`. With Corepack installed:

```sh
corepack enable
corepack prepare pnpm@11.0.7 --activate
```

The project uses `pnpm-lock.yaml`; do not create `package-lock.json` or `yarn.lock`.

```sh
pnpm install --frozen-lockfile
pnpm run lint
pnpm test
pnpm pack --dry-run
```

`lint` performs strict TypeScript checking for production code, tests, scripts and the release configuration. Tests use `node:test`, mocked Telegram responses, and local HTTP/HTTPS proxy fixtures. They do not send real Telegram messages. The localhost certificate and key in `tests/fixtures` are public test fixtures only.

`build` cleans `lib` and compiles the plugin with declarations. `test` compiles source, tests and tooling into `.test-build` and executes the generated tests; that directory is excluded from Git and the published package. The cleanup script itself runs through Node.js native TypeScript support. `pnpm pack` invokes this build through `prepack`. Runtime consumers do not need a compiler. CI runs on Node.js 22.20 and 24; release tooling is installed with `pnpm install --frozen-lockfile` as development dependencies and excluded from the runtime dependency tree.

## Automated releases

`release.config.ts` configures semantic-release with the Conventional Commits preset. CircleCI runs the release job only after both test jobs pass:

- `main` publishes a stable version to npm's `latest` channel.
- `beta` publishes prereleases such as `1.1.0-beta.1` to the `beta` channel.
- `fix:` creates a patch release, `feat:` creates a minor release, and `!` or a `BREAKING CHANGE:` footer creates a major release. Documentation, test and CI-only commits do not trigger releases by default.
- Releases create a `v${version}` Git tag, generated release notes and a GitHub Release, and publish the compiled package to npm. Package version changes happen in the release job; no generated version/changelog commit is pushed back to the repository.

### One-time setup

This repository has a fresh history and publishes the new npm package `@nuykon/semantic-release-tg-bot`. Stable releases use `main`; the first release starts at **1.0.0**. No tags or release-baseline commits from the previous package are required or imported.

Configure these secrets in the CircleCI project environment:

- `GH_TOKEN`: GitHub token with permission to push tags and create releases in this repository (`Contents: read/write` for a fine-grained token).
- `NPM_TOKEN`: npm granular access token with permission to publish `@nuykon/semantic-release-tg-bot`, configured for unattended CI publication as required by the npm account/package settings.

Keep the complete Git history and tags available to the release job. See [semantic-release configuration](https://semantic-release.org/usage/configuration/), [GitHub authentication](https://github.com/semantic-release/github#github-authentication) and [npm authentication](https://github.com/semantic-release/npm#npm-registry-authentication).

`pnpm run release:dry-run` previews the release without publishing, but still verifies access and credentials. Run `pnpm run semantic-release` only in the configured release CI environment. The repository's own release config does not send Telegram notifications; consuming projects configure notification recipients separately.

[MIT License](LICENSE)
