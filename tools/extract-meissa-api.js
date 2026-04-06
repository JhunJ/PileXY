const fs = require("fs");
const path = require("path");
const p = path.join(process.env.TEMP || "/tmp", "meissa-index.js");
const s = fs.readFileSync(p, "utf8");
const urls = s.match(/https:\/\/[a-zA-Z0-9.-]+\.[a-z]{2,}[^"'\\s]*/g) || [];
const uniq = [...new Set(urls)].filter((u) => /api|meissa|aws|amazon|execute-api/i.test(u));
console.log(uniq.slice(0, 40).join("\n"));
