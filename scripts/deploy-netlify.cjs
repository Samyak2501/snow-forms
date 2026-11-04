const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const siteId = process.env.NETLIFY_SITE_ID || 'e103d2f3-e98c-4462-83f5-5beb7a655a20';
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!token) {
  console.error('ERROR: NETLIFY_AUTH_TOKEN environment variable is required to deploy.');
  process.exit(1);
}
const distDir = path.resolve(__dirname, '..', 'client', 'dist');

function getFiles(dir, base = '') {
  let results = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const rel = base ? base + '/' + item : item;
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(getFiles(full, rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

async function deploy() {
  const files = getFiles(distDir);
  const fileMap = {};
  const bufferMap = {};
  for (const f of files) {
    const content = fs.readFileSync(path.join(distDir, f));
    const sha1 = crypto.createHash('sha1').update(content).digest('hex');
    fileMap['/' + f] = sha1;
    bufferMap['/' + f] = content;
  }

  console.log('Initiating deploy with', Object.keys(fileMap).length, 'files...');
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ files: fileMap })
  });

  const deployData = await res.json();
  console.log('Deploy ID:', deployData.id);
  console.log('Required files to upload:', deployData.required ? deployData.required.length : 0);

  if (deployData.required && deployData.required.length > 0) {
    const hashToPath = {};
    for (const [p, h] of Object.entries(fileMap)) {
      hashToPath[h] = p;
    }
    for (const hash of deployData.required) {
      const filePath = hashToPath[hash];
      console.log('Uploading:', filePath);
      const uploadRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deployData.id}/files${filePath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/octet-stream'
        },
        body: bufferMap[filePath]
      });
      console.log('Uploaded', filePath, '-> Status:', uploadRes.status);
    }
  }

  // Poll deploy status
  for (let i = 0; i < 15; i++) {
    const checkRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deployData.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const checkData = await checkRes.json();
    console.log('Deploy state:', checkData.state);
    if (checkData.state === 'ready') {
      console.log('SUCCESS! Site is ready at:', checkData.ssl_url || checkData.url);
      console.log('Summary:', JSON.stringify(checkData.summary, null, 2));
      break;
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}

deploy().catch(console.error);
