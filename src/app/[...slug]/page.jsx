// src/app/[...slug]/page.jsx
// ... imports ...
export default async function ComposablePage({ params }) { // params might be a Promise
  try {
    // Await the params object itself before destructuring/accessing
    const awaitedParams = await params;
    const slugArray = awaitedParams?.slug; // Access slug array safely

    if (!Array.isArray(slugArray) || slugArray.length === 0) {
      // Use awaitedParams in log for clarity
      console.warn("Invalid slug parameter received:", awaitedParams);
      return notFound();
    }

    const pageSlug = slugArray.join('/');
    const fullPath = `/${pageSlug}`;

    const page = await getPageFromSlug(fullPath);

    // ... rest of the rendering logic ...

  } catch (error) {
     // Use awaitedParams in error log too
     const awaitedParams = await params;
     console.error(`Error fetching or rendering page for slug '${awaitedParams?.slug?.join('/')}':`, error.message, error.stack);
     return notFound();
  }
}
