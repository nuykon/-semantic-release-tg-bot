import type {GlobalConfig} from 'semantic-release';

export default {
  repositoryUrl: 'https://github.com/nuykon/-semantic-release-tg-bot.git',
  "branches": [
    "main",
    {
      "name": "beta",
      "prerelease": true,
      "channel": "beta"
    }
  ],
  "tagFormat": "v${version}",
  "plugins": [
    [
      "@semantic-release/commit-analyzer",
      {
        "preset": "conventionalcommits"
      }
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        "preset": "conventionalcommits"
      }
    ],
    "@semantic-release/npm",
    [
      "@semantic-release/github",
      {
        "successComment": false,
        "failComment": false,
        "releasedLabels": false
      }
    ]
  ]
} satisfies GlobalConfig;
