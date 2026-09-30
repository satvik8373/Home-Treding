const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const axios = require('axios');

test('broker status requires a matching live Dhan profile and cannot be restored by sync', async () => {
  const storage = path.join(os.tmpdir(), `mavrix-broker-test-${process.pid}.json`);
  process.env.MAVRIX_BROKER_STORAGE_FILE = storage;
  const originalGet = axios.get;
  let valid = true;
  let match = false;
  axios.get = async (url) => {
    assert.equal(url, 'https://api.dhan.co/v2/profile');
    if (!valid) throw Object.assign(new Error('expired'), { response: { status: 401 } });
    return { data: { dhanClientId: match ? 'TEST123' : 'TEST999', dataPlan: 'Deactive', tokenValidity: 'Valid' } };
  };
  const app = require('../../index');
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/brokers`;
    const post = async (route, body) => fetch(`${base}${route}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    const mismatch = await post('/connect', { clientId: 'TEST123', accessToken: 'test-token' });
    assert.equal(mismatch.status, 400);
    assert.equal((await (await fetch(`${base}/list`)).json()).brokers.length, 0);
    match = true;
    const connect = await post('/connect', { clientId: 'TEST123', accessToken: 'test-token' });
    assert.equal(connect.status, 200);
    assert.equal((await connect.json()).broker.dataPlan, 'Deactive');
    let list = await (await fetch(`${base}/list`)).json();
    assert.equal(list.brokers[0].status, 'Connected');
    assert.equal(JSON.stringify(list).includes('test-token'), false);

    valid = false;
    list = await (await fetch(`${base}/list`)).json();
    assert.equal(list.brokers[0].status, 'Expired');
    const sync = await post('/sync', { broker: { clientId: 'TEST123', status: 'Connected' } });
    assert.equal(sync.status, 410);
    list = await (await fetch(`${base}/list`)).json();
    assert.equal(list.brokers[0].status, 'Expired');
  } finally {
    await new Promise(resolve => server.close(resolve));
    axios.get = originalGet;
    delete process.env.MAVRIX_BROKER_STORAGE_FILE;
    fs.rmSync(storage, { force: true });
  }
});
