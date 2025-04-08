import Markdown from 'markdown-to-jsx';

const themeClassMap = {
  primary: 'bg-purple-700 text-white',
  dark: 'bg-gray-800 text-white',
};

// This component receives props from page.jsx: {...section.fields} and id={section.sys.id}
export const Stats = (props) => {
  const sectionId = props.id; // ID of the Stats section ENTRY
  const heading = props.heading;
  const body = props.body;
  const theme = props.theme ?? 'primary';
  const statEntries = props.stats; // Array of linked StatItem ENTRY objects

  // Use the Stats entry's ID for the main object ID
  return (
    <div
      className={`px-6 py-16 text-center ${themeClassMap[theme]} sm:px-12 sm:py-24`}
      data-sb-object-id={sectionId}
    >
      <div className="mx-auto">
        <div className="mb-16">
          {/* Heading field */}
          {heading && (
            <h2 className="mb-4 text-4xl font-bold sm:text-5xl" data-sb-field-path="heading">
              {heading}
            </h2>
          )}
          {/* Body field */}
          {body && (
            <Markdown options={{ forceBlock: true }} className="sm:text-lg" data-sb-field-path="body">
              {body}
            </Markdown>
          )}
        </div>
        {/* Stats Link Array Field */}
        {/* Add data-sb-field-path here to allow reordering/changing linked items */}
        <div className="grid max-w-3xl gap-12 mx-auto sm:grid-cols-3" data-sb-field-path="stats">
          {/* Safely map over the array of linked StatItem entries */}
          {Array.isArray(statEntries) && statEntries.map((statEntry) => {
             // Basic check for valid entry object
             if (!statEntry || !statEntry.sys || !statEntry.sys.id || !statEntry.fields) {
               console.warn("Skipping invalid stat entry object:", statEntry);
               return null;
             }
             // Pass the full statItem entry object, StatItem component will extract fields/id
             // Use the unique sys.id for the key
             return <StatItem key={statEntry.sys.id} {...statEntry} />;
             }
          )}
        </div>
         {/* Hidden fields for theme if you want to edit it (optional) */}
         {/* <span data-sb-field-path="theme" className="hidden">{props.theme}</span> */}
      </div>
    </div>
  );
};

// Internal component - receives the full StatItem ENTRY object as props
const StatItem = (props) => {
  // Access fields and ID safely using optional chaining
  const label = props.fields?.label;
  const value = props.fields?.value;
  const id = props.sys?.id; // ID of the StatItem entry

  // Use the StatItem entry's ID for its object ID
  return (
    <div data-sb-object-id={id}>
      {/* Value field */}
      {value && (
        <div className="mb-3 text-4xl font-bold sm:text-5xl" data-sb-field-path="value">
          {value}
        </div>
      )}
      {/* Label field */}
      {label && (
        <div data-sb-field-path="label">{label}</div>
      )}
    </div>
  );
};
