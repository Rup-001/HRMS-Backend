const net = require('net');

const client = new net.Socket();
client.setTimeout(5000);

client.connect(4370, '172.31.31.106', function() {
  console.log('✅ TCP connection established');
  client.end();
});

client.on('timeout', () => {
  console.error('❌ Connection timeout');
  client.destroy();
});

client.on('error', (err) => {
  console.error('❌ TCP error:', err.message);
});
