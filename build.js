#!/usr/bin/env node
/* Builds the two shipped files from src/*.js:
     index.html     standalone — open it straight off disk
     artifact.html  same game, minus the doctype/head/body wrapper that the
                    Artifact platform supplies itself
   Run: node build.js
*/
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const files = fs.readdirSync(SRC).filter(f => f.endsWith(".js")).sort();

const js = files.map(f => {
  const body = fs.readFileSync(path.join(SRC, f), "utf8")
    // only the first file keeps "use strict"; the rest are concatenated into it
    .replace(/^\s*"use strict";\s*$/m, m => (f === files[0] ? m : ""));
  return `/* ===== src/${f} ===== */\n${body}`;
}).join("\n\n");

const TITLE = "Cool Matt Brawl";

const STYLE = `
  :root{ color-scheme: dark; }
  *{ box-sizing: border-box; }
  html,body{
    margin:0; height:100%; background:#05040d; color:#f2f0ff;
    font-family:"Archivo Black", Impact, "Arial Narrow Bold", system-ui, sans-serif;
    overflow:hidden; -webkit-font-smoothing:antialiased;
  }
  #wrap{ position:fixed; inset:0; display:grid; place-items:center; }
  canvas{
    display:block; touch-action:none;
    box-shadow:0 0 60px rgba(0,229,255,.16), 0 0 180px rgba(255,46,136,.10);
    background:#05040d; border-radius:4px;
  }
  #hint{
    position:fixed; left:50%; bottom:calc(5px + env(safe-area-inset-bottom,0px));
    transform:translateX(-50%);
    font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:10px;
    letter-spacing:.09em; color:#55536e; pointer-events:none; user-select:none;
    white-space:nowrap;
  }`;

const FONTLINK =
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Chakra+Petch:wght@500;600;700&display=swap">`;

const BODY =
  `<div id="wrap"><canvas id="cv"></canvas></div>\n` +
  `<div id="hint">COOL MATT GAMES &nbsp;·&nbsp; click the canvas to focus &nbsp;·&nbsp; ESC pauses &nbsp;·&nbsp; F11 fullscreen</div>`;

/* ---- standalone ---- */
fs.writeFileSync(path.join(__dirname, "index.html"),
`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${TITLE}</title>
${FONTLINK}
<style>${STYLE}
</style>
</head>
<body>
${BODY}

<script>
${js}
</script>
</body>
</html>
`);

/* ---- artifact (platform supplies the skeleton) ---- */
fs.writeFileSync(path.join(__dirname, "artifact.html"),
`<title>${TITLE}</title>
${FONTLINK}
<style>${STYLE}
</style>
${BODY}

<script>
${js}
</script>
`);

const kb = n => (fs.statSync(path.join(__dirname, n)).size / 1024).toFixed(0) + "KB";
console.log(`built from ${files.length} modules -> index.html (${kb("index.html")}), artifact.html (${kb("artifact.html")})`);
