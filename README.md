# Bib Wall

A collection of race bibs from years of type 2 fun.

Race images use content hashes in their URLs and a 31-day image optimization cache.
Unchanged images keep the same URL across deployments; replacing a bib preview or
photo automatically generates a new URL. If a public image referenced by an absolute
path is replaced, change its filename too so it bypasses the longer cache.

Image widths are limited to the sizes needed for bib cards, avatars, and race photos
to reduce Vercel transformations while retaining responsive WebP delivery.
