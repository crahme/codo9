import { notFound } from 'next/navigation';
import { Hero } from '../../components/Hero.jsx';
import { Stats } from '../../components/Stats.jsx';
import { getPageFromSlug } from '../../utils/content.js';

const componentMap = {
  hero: Hero,
  stats: Stats,
};

export default async function ComposablePage({ params }) {
  // Await params to resolve the promise
  const awaitedParams = await params;
  const { slug } = awaitedParams;
  
  const pageSlug = slug.join('/');

  try {
    // Pass the correct content type ID (replace 'page' with your actual content type ID)
    const page = await getPageFromSlug(`/${pageSlug}`, 'page');

    if (!page) {
      return notFound();
    }

    return (
      <div data-sb-object-id={page.id}>
        {(page.sections || []).map((section, idx) => {
          const Component = componentMap[section.type];
          return <Component key={idx} {...section} />;
        })}
      </div>
    );
  } catch (error) {
    console.error(error.message);
    return notFound();
  }
}
