const tierThreshold = require("./tier-threshold");
const memberBonus = require("./member-bonus");
const seasonal = require("./seasonal");

module.exports = { all: [tierThreshold, memberBonus, seasonal] };
