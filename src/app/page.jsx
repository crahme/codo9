'use client';
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Hero } from '../components/Hero.jsx';
import { Stats } from '../components/Stats.jsx';
import { Invoice } from '../components/Invoice.jsx';
import { InvoiceSection } from '../components/InvoiceSection.jsx';
import { InvoiceLineItem } from '../components/InvoiceLineItem.jsx';
import { VisualEditorComponent } from '../components/VisualEditorComponent.jsx';
import { getPageFromSlug } from '../utils/content.js';

// Map Contentful Content Type IDs to React components
const componentMap = {
  hero: Hero,
  stats: Stats,
  Invoice: Invoice,
  InvoiceSection: InvoiceSection,
  InvoiceLineItem: InvoiceLineItem,
  visualEditorComponent: VisualEditorComponent,
  // Add mappings for any other section types you might create
};

export default function HomePage() {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getPageFromSlug("/", 'page');
        setPage(data);
      } catch (error) {
        console.error("Error fetching or rendering homepage:", error.message, error.stack);
        setPage(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function handleNavigation() {
    window.location.href = '/invoice/fac-2024-001/';
  }

  if (loading) return <div>Loading...</div>;
  if (!page || !page.fields || !page.fields.sections) return notFound();

  return (
    <div data-sb-object-id={page.sys.id}>
      {Array.isArray(page.fields.sections) && page.fields.sections.map((section) => {
        if (!section || !section.sys || !section.sys.contentType || !section.sys.contentType.sys || !section.sys.id || !section.fields) {
          console.warn("Skipping rendering of invalid section object:", section);
          return null;
        }
        const contentTypeId = section.sys.contentType.sys.id;
        const Component = componentMap[contentTypeId];
        if (!Component) {
          console.warn(`No component mapped for section content type: ${contentTypeId}`);
          return <div key={section.sys.id}>Component for {contentTypeId} not found</div>;
        }
        return <Component key={section.sys.id} {...section.fields} id={section.sys.id} />;
      })}
      <button onClick={handleNavigation}>Invoice</button>
    </div>
  );
}
