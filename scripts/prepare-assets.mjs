import fs from "node:fs";
fs.mkdirSync("public/vendor/swagger", { recursive: true });
for (const name of ["swagger-ui-bundle.js", "swagger-ui.css"])
  fs.copyFileSync(
    `node_modules/swagger-ui-dist/${name}`,
    `public/vendor/swagger/${name}`,
  );
