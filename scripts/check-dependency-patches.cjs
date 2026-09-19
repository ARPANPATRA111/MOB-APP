const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const {
  getImageDimensions,
} = require("../node_modules/metro/src/lib/imageSize.js");
const invalid = Buffer.alloc(24);
invalid.write("icns");
invalid.writeUInt32BE(24, 4);
invalid.write("icp4", 8);
assert.throws(() => getImageDimensions("icns", invalid, "invalid.icns"));
const box = Buffer.alloc(16);
box.write("ftyp", 4);
assert.throws(() => getImageDimensions("heif", box, "invalid.heif"));
assert.ok(
  getImageDimensions("png", fs.readFileSync("assets/icon.png"), "icon.png")
    .width > 0,
);
const file = path.resolve(
  "node_modules/@react-navigation/core/src/queryString.ts",
);
const loaded = new Module(file, module);
loaded._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  file,
);
const parse = loaded.exports.parse;
assert.equal(parse("name=%E2%82%AC+shop").name, "\u20ac shop");
assert.equal(parse("name=" + "%FE".repeat(20000)).name, "%FE".repeat(20000));
assert.equal(parse("name=%FE%20%C3%A5").name, "%FE \u00e5");
assert.equal(Object.getPrototypeOf(parse("__proto__=safe")), null);
for (const name of ["image-size", "decode-uri-component"])
  assert.throws(() => require.resolve(name), /Cannot find module/);
const project = require("xcode").project("unused.pbxproj");
project.hash = { project: { objects: {} } };
assert.match(project.generateUuid(), /^[A-F0-9]{24}$/);
console.log(
  "PASS dependency security: bounded image parsing, URI decoding and UUID compatibility",
);
