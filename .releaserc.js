module.exports = {
  branches: [
    "main"
  ],
  tagFormat: "v${version}",
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md"
      }
    ],
    [
      "@semantic-release/npm",
      {
        "npmPublish": false
      }
    ],
    [
      "./scripts/update-system-json.js"
    ],
    [
      "@semantic-release/git",
      {
        "assets": [
          "package.json",
          "system.json",
          "CHANGELOG.md"
        ],
        "message": "chore(release): ${nextRelease.version} [skip ci]"
      }
    ],
    [
      "@semantic-release/github",
      {
        "assets": [
          {
            "path": "dod.zip",
            "label": "dod.zip"
          },
          {
            "path": "system.json",
            "label": "system.json"
          }
        ]
      }
    ]
  ]
};
