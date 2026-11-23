# Bib Wall

A collection of race bibs from years of type 2 fun.

## Race images

`npm run dev` and `npm run build` automatically prepare responsive WebP files from
original bibs and photos referenced in `races/*/index.md`. The cross-platform Sharp
pipeline preserves transparency, corrects photo orientation, and never upscales.
No macOS-only tools or manual preview generation are required.

Prepared images use widths of 320, 640, 960, 1280, and 1920 pixels. Bib cards and
photo galleries select a responsive variant through a custom Next.js image loader,
so those requests bypass Vercel Image Optimization and the race-assets function.
The timeline also uses the prepared files. Originals and existing preview files
are preserved.

Filenames include a hash of source content and encoding settings, with a one-year
immutable cache. Replacing an original automatically creates new URLs. A generated
manifest supplies image URLs without reading or hashing images on page requests.

Run `npm run images:prepare` after adding or changing images while the dev server
is running. Existing generated variants are reused; unreferenced variants are
removed. Generated files in `public/race-images` and `src/lib/generated` are ignored
by Git and recreated on each deployment. `npm run typecheck` also prepares them.

Absolute public image paths keep the default Next.js optimizer and 31-day cache;
rename those files when replacing them. Static delivery still uses bandwidth.
