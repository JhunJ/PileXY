const fs = require("fs");
const p = require("path").join(process.env.TEMP, "meissa-index.js");
const s = fs.readFileSync(p, "utf8");
const re = /"(\/[a-zA-Z0-9_\-{}]+)+"/g;
const hits = new Set();
let m;
while ((m = re.exec(s))) {
  const x = m[1];
  if (x.includes("project") || x.includes("zone") || x.includes("snapshot") || x.includes("auth")) hits.add(m[0]);
}
[...hits].slice(0, 80).forEach((h) => console.log(h));
