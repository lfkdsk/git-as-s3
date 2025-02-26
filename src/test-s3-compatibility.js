const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3'); 
const fs = require('fs');

// Create basic client
const s3 = new S3Client({
  endpoint: 'http://localhost:3000/s3/',
  forcePathStyle: true,
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy'
  },
  region: 'us-east-1'
});

const BUCKET = 'lfkdsk@git-as-s3-test';
const TEST_FILE = 'test.txt';
const TEST_CONTENT = 'Hello, S3 compatibility test!';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test S3 operations
async function testS3Compatibility() {
  try {
    console.log('Starting S3 compatibility test...');

    // Test file upload
    console.log('\n1. Testing file upload...');
    const uploadResult = await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: TEST_FILE,
      Body: TEST_CONTENT,
    }));
    console.log('Upload successful, ETag:', uploadResult.ETag);

    // Wait 1 second to ensure file is fully uploaded
    await wait(1000);

    // Test file download
    console.log('\n2. Testing file download...');
    const downloadResult = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: TEST_FILE
    }));
    const downloadBody = await downloadResult.Body.transformToString();
    console.log('Download successful, content:', downloadBody);
    console.log('Content-Type:', downloadResult.ContentType);
    console.log('ETag:', downloadResult.ETag);

    // Test listing files
    console.log('\n3. Testing file listing...');
    const listResult = await s3.send(new ListObjectsCommand({
      Bucket: BUCKET,
    }));
    console.log('File list:');
    if (listResult.Contents && listResult.Contents.length > 0) {
      console.log(JSON.stringify(listResult.Contents, null, 2));
    } else {
      console.log('(empty)');
    }

    // Test file deletion
    console.log('\n4. Testing file deletion...');
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: TEST_FILE
    }));
    console.log('Deletion successful');

    // Verify file deletion
    console.log('\n5. Verifying file deletion...');
    try {
      await s3.send(new GetObjectCommand({
        Bucket: BUCKET,
        Key: TEST_FILE
      }));
      throw new Error('File still exists, deletion failed');
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        console.log('File successfully deleted');
      } else {
        throw error;
      }
    }

    console.log('\n✅ All tests passed!');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

// Run tests
testS3Compatibility();