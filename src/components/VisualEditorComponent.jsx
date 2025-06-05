// src/components/VisualEditorComponent.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * VisualEditorComponent
 * Renders a value for live editing or display, falls back to a placeholder if not provided.
 * 
 * Props:
 * - contentId: string (entry or object ID)
 * - fieldName: string (field to edit/display)
 * - displayValue: string or node (optional, value to display)
 * - isRichText: boolean (optional, if true, dangerouslySetInnerHTML is used)
 */
export function VisualEditorComponent({
  contentId,
  fieldName,
  displayValue = '',
  isRichText = false,
}) {
  if (!contentId || !fieldName) {
    return <span style={{ color: 'red' }}>Missing content reference</span>;
  }

  // If isRichText, render as rich HTML; otherwise, render as plain text.
  if (isRichText) {
    return (
      <span
        data-content-id={contentId}
        data-field-name={fieldName}
        dangerouslySetInnerHTML={{
          __html: displayValue || ''
        }}
        style={{ background: '#f5f5fa', padding: '2px 4px' }}
      />
    );
  }

  return (
    <span
      data-content-id={contentId}
      data-field-name={fieldName}
      style={{ background: '#f5f5fa', padding: '2px 4px' }}
    >
      {displayValue || ''}
    </span>
  );
}

VisualEditorComponent.propTypes = {
  contentId: PropTypes.string.isRequired,
  fieldName: PropTypes.string.isRequired,
  displayValue: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.node,
  ]),
  isRichText: PropTypes.bool,
};
