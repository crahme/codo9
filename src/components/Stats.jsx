// Inside Stats.jsx

const StatItem = (props) => {
  // Access fields correctly from the passed entry object
  const label = props.fields?.label;
  const value = props.fields?.value;
  const id = props.sys?.id; // Get ID from sys object

  // Use the StatItem entry's ID for its object ID
  return (
    <div data-sb-object-id={id}>
      {/* Check if value exists before rendering */}
      {value && (
        <div className="mb-3 text-4xl font-bold sm:text-5xl" data-sb-field-path="value">
          {value}
        </div>
      )}
      {/* Check if label exists before rendering */}
      {label && (
        <div data-sb-field-path="label">{label}</div>
      )}
    </div>
  );
};
