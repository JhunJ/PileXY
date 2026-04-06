const fs = require("fs");
const p = require("path").join(process.env.TEMP, "meissa-index.js");
const s = fs.readFileSync(p, "utf8");
for (const name of ["Te=oi.create", "Ja=oi.create", "sle=ND.create", "lle=ND.create"]) {
  const i = s.indexOf(name);
  if (i >= 0) console.log(s.slice(i, i + 200), "\n---\n");
}
