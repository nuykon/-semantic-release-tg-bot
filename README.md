# @nuykon/semantic-release-tg-bot

Telegram notifications for semantic-release, implemented in TypeScript with Node.js built-ins. The published CommonJS package includes declarations and has no runtime dependencies.

## Getting started

Requirements: Node.js 22.20+ and an existing semantic-release project.

```sh
pnpm add -D @nuykon/semantic-release-tg-bot
```

Add a notification destination alongside your other release plugins:

```ts
// release.config.ts
export default {
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@nuykon/semantic-release-tg-bot', {
      notifications: [{chatIds: 'RELEASE_DESTINATION'}],
    }],
  ],
};
```

Provide `TELEGRAM_BOT_TOKEN` and, for this example, `RELEASE_DESTINATION` through your CI environment. Recipients may also be literal numeric IDs, numeric strings, or channel usernames. An array sends the notification to each destination in order.

For a personal notification, use the user's numeric private-chat ID. That user must first start a conversation with your bot. A personal `@username` cannot replace the ID. Telegram describes these restrictions in its [bot guide](https://core.telegram.org/bots#how-are-bots-different-from-users) and [sendMessage reference](https://core.telegram.org/bots/api#sendmessage).

## Proxy configuration

Set **`TELEGRAM_BOT_PROXY`** to route Telegram requests through an HTTP or HTTPS CONNECT proxy:

```sh
export TELEGRAM_BOT_PROXY='http://relay.example:3128'
# Alternatively:
export TELEGRAM_BOT_PROXY='https://relay.example:8443'
# Credentials may be included; encode reserved URL characters:
export TELEGRAM_BOT_PROXY='http://operator:s%3Aecret@relay.example:3128'
```

Put authenticated URLs in CI secrets. With the variable absent, requests go directly to Telegram. This setting is read from the release context's `env`; the plugin has no separate proxy field and does not select a proxy from `HTTP_PROXY`, `HTTPS_PROXY` or `ALL_PROXY`.

TLS certificate validation stays enabled for both connections. SOCKS is outside the supported transport set. Each delivery has a 30-second deadline, including tunnel negotiation, and a 1 MiB response limit. Errors propagate to semantic-release. Automatic retries are intentionally absent because an ambiguous response could otherwise produce duplicate messages.

## Notification rules

The root options are `notifications`, optional `packageName`, `success`, `fail`, `notifyOnSuccess` and `notifyOnFail`.

Every entry in `notifications` contains `chatIds` and may override either message or either notification flag. It may also specify `branch`, matched with Node.js `path.posix.matchesGlob`. For example, `stable/*.x` accepts `stable/4.x`; `stable/**` also accepts deeper paths. Brace patterns such as `{main,beta}` and extglobs such as `@(main|beta)` are supported by the Node.js matcher.

Success is enabled unless overridden; failure is disabled unless enabled. A recipient's explicit flag overrides the root flag. A branch-filtered entry is skipped when semantic-release has no branch information.

The package label comes from the first nonblank value among `packageName`, `SEMANTIC_RELEASE_PACKAGE` and `npm_package_name`. Verification requires that label and a nonblank bot token. Verification errors expose `code`, `details` and `semanticRelease: true` for the release tool.

The default success text contains a completion heading, package label, version and optional release notes. The default failure text contains a failure heading, package label and available error descriptions/stacks. Failure messages work even before a next release exists. Empty rendered messages are skipped.

## Custom content

An inline content object uses `message`, optional `format` and optional `customData`:

```ts
{
  message: '<b>{{ packageName }}</b>: ${nextRelease.version}',
  format: 'html',
  customData: {team: 'operations'},
}
```

The default format is `markdown`. Placeholders accept dotted property paths, including numeric array segments. Both `${value}` and `{{ value }}` forms are available. Missing/null values produce empty text; substituted values are not evaluated a second time. Prototype-related paths and expression/control-tag syntax are rejected. No JavaScript is evaluated by the placeholder renderer.

The supplied context includes `packageName`, `branch`, `lastRelease`, `nextRelease`, `commits` and `errors`. `customData` overrides matching context entries. HTML values are inserted literally: escape untrusted data when creating HTML notifications.

Use a synchronous callback when you need calculations or iteration:

```ts
import type {TemplateContext} from '@nuykon/semantic-release-tg-bot';

const content = {
  format: 'html' as const,
  message: ({nextRelease}: TemplateContext): string =>
    `<code>${nextRelease?.version ?? 'unavailable'}</code>`,
};
```

Callbacks must return a string. Their result is not interpolated again. Template configuration and callbacks are trusted application code.

A file content object uses `path` plus optional `customData`. Files resolve from the release process's working directory. A `.html` suffix selects HTML, case-insensitively; other suffixes select MarkdownV2. File content receives placeholder substitution and trimming, then is sent as authored Telegram syntax. It does not go through the Markdown converter.

### Markdown scope

The inline converter handles ATX headings, simple unordered lists, emphasis, strikeout, inline code, fenced code and inline links using HTTP(S), `tg` or `mailto`. Literal Telegram MarkdownV2 punctuation is escaped. `<small>` wrappers commonly found in release notes are discarded.

It is a focused release-note formatter, not a CommonMark/GFM implementation. Unsupported tables, reference links, images, quotations and complex nesting may appear as literal text or simplified formatting. Choose authored HTML or MarkdownV2 file templates when exact output is required.

## Working on the project

All maintained code, tests and helper scripts use TypeScript. JSON/YAML files are configuration data. Use the pnpm version pinned in `packageManager`:

```sh
corepack enable
corepack prepare pnpm@11.0.7 --activate
pnpm install --frozen-lockfile
pnpm run lint
pnpm test
pnpm pack --dry-run
```

The production build writes JavaScript/declarations to `lib`. Tests compile into `.test-build` and run with `node:test`. Neither test output nor development dependencies belong in the published package. `pnpm pack` runs the build through `prepack`.

Test suites use generated temporary template files, an HTTP boundary double, and local TLS/CONNECT servers. They do not contact Telegram. The localhost certificate/private key under `tests/fixtures` is a public testing identity.

## Releasing this package

The repository is [nuykon/-semantic-release-tg-bot](https://github.com/nuykon/-semantic-release-tg-bot). Its `release.config.ts` uses Conventional Commits. CircleCI tests Node.js 22.20 and 24 before allowing a release:

- `main` produces stable versions on npm's `latest` channel.
- `beta` produces prerelease versions on the `beta` channel.
- `fix:` requests a patch; `feat:` requests a minor; `!` or a `BREAKING CHANGE:` footer requests a major.

This new package starts at `1.0.0`. Its history does not need a tag from another package. A release creates its version tag and GitHub release notes, then publishes the package. The job does not commit generated version changes back to the repository.

CircleCI needs `GH_TOKEN` with tag/release write access to this repository and `NPM_TOKEN` with publish access to `@nuykon/semantic-release-tg-bot`. Keep Git history and tags available. See [semantic-release configuration](https://semantic-release.org/usage/configuration/) and the [npm plugin's authentication instructions](https://github.com/semantic-release/npm#npm-registry-authentication).

`pnpm run release:dry-run` previews a release while still checking credentials. `pnpm run semantic-release` is the publishing command. The repository does not configure itself as a Telegram recipient; notification settings belong to consuming projects.

## Compatibility

Existing consumers of the previous Telegram notification plugin can retain the documented option names and environment variables. Advanced Lodash/Nunjucks expressions and full micromatch behavior are not provided. Use dotted placeholders or callbacks, verify native branch patterns, and review the Markdown scope above. Default wording and verification diagnostics are specific to this implementation.

Maintainer: [Sergey Levchenko](https://github.com/nuykon). Distributed under [MIT](LICENSE).
