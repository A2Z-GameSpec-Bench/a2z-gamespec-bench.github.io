# A2Z GameSpec-Bench project website

Static website for A2Z GameSpec-Bench, with Home and At a glance pages. No build step is required.

## Local preview

From this directory, run:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Deployment

The website repository is [A2Z-GameSpec-Bench/a2z-gamespec-bench.github.io](https://github.com/A2Z-GameSpec-Bench/a2z-gamespec-bench.github.io). Publish the `main` branch's root directory through GitHub Pages. Keep `.nojekyll` and the `assets` directory alongside the HTML files.

The site address is <https://a2z-gamespec-bench.github.io/>. Benchmark code is maintained separately in [krafton-ai/a2z-gamespec-bench](https://github.com/krafton-ai/a2z-gamespec-bench).

## Editing

- `index.html` and `at-a-glance.html`: page content.
- `styles.css`: layout, typography, responsive behavior, and animation.
- `script.js`: interactions, result charts, and media selection.
- `site-config.js`: paper, code, and opening-video URLs. `paperUrl` points to the published arXiv abstract page.
- `assets/`: fonts, logos, screenshots, and gameplay clips used by the pages.

## Asset credits

Urbanist is distributed under the [SIL Open Font License 1.1](assets/fonts/Urbanist-OFL.txt). Model icons are from [LobeHub Icons](https://github.com/lobehub/lobe-icons), with the [MIT license](assets/icons/LICENSE) and [source information](assets/icons/SOURCE.json) included. KRAFTON SANS and KRAFTON branding retain their respective copyright notices. Template attribution appears on the At a glance page.
