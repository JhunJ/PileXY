const fs = require("fs");
const p = require("path").join(process.env.TEMP, "meissa-index.js");
const s = fs.readFileSync(p, "utf8");
const patterns = [
  "login",
  "signIn",
  "token",
  "/users",
  "sessions",
  "password",
  "email",
  "Authorization",
  "accessToken",
  "refreshToken",
];
for (const pat of patterns) {
  const re = new RegExp(`.{0,30}${pat}.{0,80}`, "gi");
  let m;
  let c = 0;
  while ((m = re.exec(s)) && c < 3) {
    if (m[0].includes("platform-api") || m[0].includes("/auth") || m[0].includes("/api") || pat === "login") {
      console.log(pat, ":", m[0].replace(/\n/g, " ").slice(0, 200));
      c++;
    }
  }
}
