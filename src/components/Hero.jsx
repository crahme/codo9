import Markdown from 'markdown-to-jsx';
import Image from 'next/image';
import { Button } from './Button.jsx'; // Assuming Button.jsx is in the same directory

const themeClassMap = {
  imgLeft: 'md:flex-row-reverse',
  imgRight: 'md:flex-row',
};

// This component receives props from page.jsx: {...section.fields} and id={section.sys.id}
export const Hero = (props) => {
  // Extract fields from props, using optional chaining for safety
  const heading = props.heading;
  const body = props.body;
  const theme = props.theme ?? 'imgRight'; // Default theme
  const buttonEntry = props.button; // This is the linked Button ENTRY object
  const imageAsset = props.image; // This is the linked Image ASSET object
  const sectionId = props.id; // The ID of the Hero section ENTRY passed from page.jsx

  // --- Data validation and extraction for linked items ---
  const imageUrl = imageAsset?.fields?.file?.url;
  const imageAlt = imageAsset?.fields?.description || imageAsset?.fields?.title || '';
  const imageId = imageAsset?.sys?.id; // ID of the linked Asset

  const buttonFields = buttonEntry?.fields;
  const buttonId = buttonEntry?.sys?.id; // ID of the linked Button entry
  // --- End data validation ---

  // Use the Hero entry's ID for the main object ID
  return (
    <div className="px-6 py-16 bg-gray-100 sm:px-12 sm:py-24" data-sb-object-id={sectionId}>
      <div className={`max-w-6xl mx-auto flex flex-col gap-12 md:items-center ${themeClassMap[theme]}`}>
        <div className="w-full max-w-xl mx-auto flex-1">
          {/* Heading field */}
          {heading && (
            <h1 className="mb-6 text-4xl font-bold sm:text-5xl" data-sb-field-path="heading">
              {heading}
            </h1>
          )}
          {/* Body field */}
          {body && (
            <Markdown options={{ forceBlock: true }} className="mb-6 text-lg" data-sb-field-path="body">
              {body}
            </Markdown>
          )}
          {/* Button Link Field - Pass button fields and ID to Button component */}
          {/* Add data-sb-field-path here to allow changing the linked button */}
          {buttonFields && buttonId && (
             <div data-sb-field-path="button"> {/* Annotate the link field */}
               <Button {...buttonFields} id={buttonId} />
             </div>
          )}
        </div>
        <div className="w-full aspect-[4/3] flex-1 relative overflow-hidden rounded-md">
          {/* Image Link Field */}
          {imageUrl && (
            <Image
              // Use the asset's ID for its annotation if needed, or keep it simple
              // data-sb-object-id={imageId}
              src={`https:${imageUrl}`} // Prepend https: if URL is protocol-relative
              alt={imageAlt}
              fill
              className='object-cover'
              sizes="(max-width: 767px) 100vw, (max-width: 1200px) 50vw, 600px"
              data-sb-field-path="image" // Annotate the image field on the Hero entry
            />
          )}
        </div>
         {/* Hidden fields for theme if you want to edit it (optional) */}
         {/* <span data-sb-field-path="theme" className="hidden">{props.theme}</span> */}
      </div>
    </div>
  );
};
