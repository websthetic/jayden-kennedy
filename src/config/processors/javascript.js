const esbuild = require("esbuild");
const { glob } = require("glob");

const isProduction = process.env.ELEVENTY_ENV === "PROD";

module.exports = async function () {
    const files = await glob("src/assets/js/**/*.js");
    await esbuild.build({
        entryPoints: files,
        outdir: "./public/assets/js",
        write: true,
        bundle: true,
        minify: isProduction,
        sourcemap: !isProduction,
        target: isProduction ? "es6" : "esnext",
        // Build-time substitution, not a runtime env lookup — this is a
        // static-site bundle with no server to read process.env at
        // request time. esbuild replaces the literal text
        // process.env.MAPBOX_TOKEN with this JSON-stringified value
        // everywhere it appears in the bundled source (listings-map.js).
        // Read from Netlify's dashboard env vars during Netlify's own
        // build step, or from .env.local for a local `npm run build` /
        // `netlify dev` (netlify dev injects .env.local into
        // process.env for the whole dev process, this script included).
        // Set to "" if unset rather than left undefined, so a missing
        // var fails as an empty string (handled gracefully by
        // listings-map.js's own token check) instead of a ReferenceError
        // from a bare `undefined` substitution.
        define: {
            "process.env.MAPBOX_TOKEN": JSON.stringify(process.env.MAPBOX_TOKEN || ""),
        },
    });
};
