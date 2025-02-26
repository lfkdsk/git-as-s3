
<p align="center">
  <img src="logo.webp" width=200px height=200px alt="描述" />
</p>

# Git-as-S3

A GitHub repository proxy service that provides S3-compatible API, allowing you to operate files in GitHub repositories as if using S3.

## Features

- S3-compatible API interface
- Support for file upload, download, delete, and list operations
- Uses GitHub repository as storage backend
- Support for large file handling
- Support for filenames with special characters

## Installation

### Prerequisites

- Node.js (v12 or higher)
- npm or yarn package manager
- GitHub account and personal access token

### Installation Steps

1. Clone the repository:
```bash
git clone https://github.com/yourusername/git-as-s3.git
cd git-as-s3
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Copy the `.env.example` file to `.env` and set the following environment variables:
```
GITHUB_TOKEN=your_github_token_here
PORT=3000
```

4. Start the service:
```bash
npm start
```

## API Documentation

### Get File

```http
GET /s3/:owner/:repo/:filepath
```

Example:
```bash
curl http://localhost:3000/s3/owner/repo/test.txt
```

### Upload File

```http
PUT /s3/:owner/:repo/:filepath
```

Example:
```bash
curl -X PUT -d "Hello World" http://localhost:3000/s3/owner/repo/test.txt
```

### Delete File

```http
DELETE /s3/:owner/:repo/:filepath
```

Example:
```bash
curl -X DELETE http://localhost:3000/s3/owner/repo/test.txt
```

### List Files

```http
GET /s3/:owner/:repo
```

Example:
```bash
curl http://localhost:3000/s3/owner/repo
```

## Using AWS SDK

You can use the AWS SDK to interact with this service just like you would with S3:

```javascript
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  endpoint: 'http://localhost:3000',
  s3ForcePathStyle: true,
  accessKeyId: 'dummy',     // Can use any value
  secretAccessKey: 'dummy',  // Can use any value
  signatureVersion: 'v4'
});

// Upload file
await s3.putObject({
  Bucket: 'owner@repo',
  Key: 'test.txt',
  Body: 'Hello World'
}).promise();

// Download file
const { Body } = await s3.getObject({
  Bucket: 'owner@repo',
  Key: 'test.txt'
}).promise();

// Delete file
await s3.deleteObject({
  Bucket: 'owner@repo',
  Key: 'test.txt'
}).promise();

// List files
const { Contents } = await s3.listObjects({
  Bucket: 'owner@repo'
}).promise();
```

## Important Notes

1. Ensure your GitHub Token has sufficient permissions (repo scope required)
2. File size is limited by GitHub API restrictions
3. Operation frequency is subject to GitHub API rate limits
4. It's recommended to add appropriate authentication mechanisms in production environments

## Development

### Running Tests

```bash
npm test
```

### Start in Development Mode

```bash
npm run dev
```

## License

MIT License