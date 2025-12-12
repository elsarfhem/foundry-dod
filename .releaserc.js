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
      "@semantic-release/github",
      {
        "assets": [
          {
            "path": "dod.zip",
            "name": "dod.zip",
            "label": "System Archive"
          },
          {
            "path": "system.json",
            "name": "system.json",
            "label": "System Manifest"
          }
        ]
      }
    ]
  ]
};

