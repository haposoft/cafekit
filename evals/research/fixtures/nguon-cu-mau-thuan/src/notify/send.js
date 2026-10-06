const { RelayClient } = require("@tessivox/relay");
const config = require("../../config/notify.json");

const client = new RelayClient({ plan: config.relay.plan });

// Gửi thông báo theo nhịp config.relay.requestsPerMinute.
async function send(message) {
  return client.send(message);
}

module.exports = { send };
