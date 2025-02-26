const express = require('express');
const { Octokit } = require('@octokit/rest');
const winston = require('winston');
const { Builder } = require('xml2js');
const router = express.Router();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Initialize GitHub API client
const octokit = new Octokit({
  auth: process.env.TOKEN_GITHUB
});

// Parse bucket name to get owner and repo
const parseBucket = (bucket) => {
  const [owner, repo] = bucket.split('@');
  if (!owner || !repo) {
    throw new Error('Invalid bucket format. Expected format: owner@repo');
  }
  return { owner, repo };
};

// Get object
router.get('/:bucket/*', async (req, res) => {
  const startTime = Date.now();
  try {
    const { owner, repo } = parseBucket(req.params.bucket);
    const path = req.params[0];

    logger.info(`Start processing GET request: ${req.path}`, {
      owner,
      repo,
      path
    });

    // Get content from GitHub
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: path,
    });

    // Handle directory listing
    if (Array.isArray(response.data)) {
      const contents = response.data
        .filter(item => item.type === 'file')
        .map(item => ({
          Key: item.path,
          ETag: `"${item.sha}"`,
          Size: item.size,
        }));

        const result = {
          ListBucketResult: {
            xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/',
            Name: req.params.bucket,
            IsTruncated: false,
            Contents: contents,
          }
        };

        const builder = new Builder({
          renderOpts: { pretty: true, indent: '  ', newline: '\n' },
          xmldec: { version: '1.0', encoding: 'UTF-8' }
        });

        res.set('Content-Type', 'application/xml');
        res.status(200).send(
          builder.buildObject(result)
        );

      logger.info(`LIST request processed successfully: ${req.path}`, {
        owner,
        repo,
        prefix: path,
        fileCount: contents.length,
        processingTime: Date.now() - startTime
      });

      return;
    }

    // Handle file content
    const content = Buffer.from(response.data.content, 'base64');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', content.length);
    res.setHeader('ETag', `"${response.data.sha}"`);
    res.send(content);

    logger.info(`GET request processed successfully: ${req.path}`, {
      owner,
      repo,
      size: content.length,
      processingTime: Date.now() - startTime
    });
  } catch (error) {
    logger.error(`error GET request:`, {
      error: error.message,
      stack: error.stack
    });
    if (error.message === 'Invalid bucket format. Expected format: owner@repo') {
      res.status(400).json({ error: error.message });
    } else if (error.status === 404) {
      const errorResponse = {
        Error: {
          Code: ['NoSuchKey'],
          Message: ['The specified key does not exist.'],
          Key: [req.params.key || 'unknown-key'],
        }
      };

      const builder = new Builder({
        renderOpts: { pretty: true, indent: '  ', newline: '\n' },
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        headless: false  // Ensure XML declaration header is included
      });
      res.set('Content-Type', 'application/xml');
      res.status(404).send(builder.buildObject(errorResponse))
    } else {
      logger.error(`GET request processing failed: ${req.path}`, {
        bucket: req.params.bucket,
        path: req.params[0],
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: error.message });
    }
  }
});

// Upload object
router.put('/:bucket/*', async (req, res) => {
  try {
    const { owner, repo } = parseBucket(req.params.bucket);
    const path = req.params[0];
    const content = req.body;
    const encoded = Buffer.from(content).toString('base64')
    logger.info(`Start processing upload request: ${path}`, {
      owner,
      repo,
      path,
      encoded
    });

    // Try to get existing file's SHA
    let sha = '';
    try {
      const existingFile = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: path,
      });
      sha = existingFile.data.sha;
    } catch (error) {}

    // Upload content to GitHub
    const message = `Upload ${path}`
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: encoded,
      sha: sha,
    });

    logger.info(`result upload request: ${path}`, {
      owner,
      repo,
    });

    const responseSha = `"${response.data.content.sha}"`

    res.status(200).json({
      ETag: responseSha,
    });
  } catch (error) {
    const msg = error.message
    logger.error(`error upload request:`, {
      msg,
    });

    if (error.message === 'Invalid bucket format. Expected format: owner@repo') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete object
router.delete('/:bucket/*', async (req, res) => {
  try {
    const { owner, repo } = parseBucket(req.params.bucket);
    const path = req.params[0];

    // Get current file SHA
    const fileData = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: path,
    });

    // Delete file from GitHub
    await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path: path,
      message: `Delete ${path}`,
      sha: fileData.data.sha,
      branch: 'main'
    });

    res.status(204).send();
  } catch (error) {
    logger.error(`error delete request:`, {
      error: error.message,
      stack: error.stack
    });
    if (error.message === 'Invalid bucket format. Expected format: owner@repo') {
      res.status(400).json({ error: error.message });
    } else if (error.status === 404) {
      res.status(404).json({ error: 'Not Found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// List objects
router.get('/:bucket', async (req, res) => {
  const startTime = Date.now();
  try {
    const { owner, repo } = parseBucket(req.params.bucket);
    const prefix = req.query.prefix || '';

    logger.info(`Start processing LIST request: ${req.path}`, {
      owner,
      repo,
      prefix
    });

    // Get file list from GitHub
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: prefix,
    });

    // Convert to S3 compatible response format
    const contents = response.data
      .filter(item => item.type === 'file')
      .map(item => ({
        Key: item.path,
        ETag: `"${item.sha}"`,
        Size: item.size,
      }));

    const result = {
      ListBucketResult: {
        xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/',
        Name: req.params.bucket,
        Prefix: prefix,
        IsTruncated: false,
        Contents: contents.map(item => ({
          Key: item.Key,
          ETag: item.ETag,
          Size: item.Size,
          LastModified: new Date().toISOString()
        }))
      }
    };

    res.set('Content-Type', 'application/xml');
    const builder = new Builder({
      renderOpts: { pretty: true, indent: '  ', newline: '\n' },
      xmldec: { version: '1.0', encoding: 'UTF-8' }
    });
    res.status(200).send(
      builder.buildObject(result)
    );

    logger.info(`LIST request processed successfully: ${req.path}`, {
      owner,
      repo,
      prefix,
      fileCount: contents.length,
      processingTime: Date.now() - startTime
    });
  } catch (error) {
    logger.error(`error LIST request:`, {
      error: error.message,
      stack: error.stack
    });
    if (error.message === 'Invalid bucket format. Expected format: owner@repo') {
      res.status(400).json({ error: error.message });
    } else {
      logger.error(`LIST request processing failed: ${req.path}`, {
        bucket: req.params.bucket,
        prefix: req.query.prefix,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = router;