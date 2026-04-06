const fs = require("fs");
const p = require("path").join(process.env.TEMP, "meissa-index.js");
const s = fs.readFileSync(p, "utf8");
const needle = "platform-api.meissa.ai";
let i = 0;
let n = 0;
while ((i = s.indexOf(needle, i)) !== -1 && n < 5) {
  console.log("---", n, "---");
  console.log(s.slice(Math.max(0, i - 80), i + needle.length + 120));
  i += needle.length;
  n++;
}
