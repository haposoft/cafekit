const express = require("express");
const { fmtName } = require("./format");
const router = express.Router();
const rows = [];
router.get("/", (req, res) => res.json(rows.map((c) => ({ id: c.id, name: fmtName(c) }))));
module.exports = { router, rows };
