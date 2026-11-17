# Fonts

Sofia Sans and Sofia Sans Condensed (The Sofia Sans Project Authors, https://github.com/lettersoup/Sofia-Sans), under the SIL Open Font License 1.1 in `OFL.txt`. Served by the app itself (spec 09, 09-C2): Vite bundles and hashes them, so no request goes to a font host.

Each file is the variable font (weight axis 1–1000) from the Google Fonts repository (`ofl/sofiasans/SofiaSans[wght].ttf`, `ofl/sofiasanscondensed/SofiaSansCondensed[wght].ttf`), subset to Latin, Latin Extended, "≈" (U+2248) and "×", keeping every layout feature (tabular figures). Google's own Latin subsets leave out "≈", which the app uses for estimated values. Built on 2026-11-17 with:

```sh
uvx --from 'fonttools[woff]' pyftsubset 'SofiaSans[wght].ttf' \
  --unicodes='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20C0,U+2113,U+2248,U+00D7' \
  --layout-features='*' --flavor=woff2 --output-file=sofia-sans.woff2
```

The same command on `SofiaSansCondensed[wght].ttf` gives `sofia-sans-condensed.woff2`.
