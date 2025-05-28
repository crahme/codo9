// components/InvoiceLineItem.jsx
import React from 'react';
import PropTypes from 'prop-types';
import VisualEditorComponent from '../VisualEditorComponent';

const InvoiceLineItem = ({ lineItem }) => {
  const formatTime = (dateTimeString) => {
    return new Date(dateTimeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <tr>
      <td>
        <VisualEditorComponent 
          contentId={lineItem.sys.id} 
          fieldName="date" 
          displayValue={new Date(lineItem.date).toLocaleDateString()}
        />
      </td>
      <td>
        <VisualEditorComponent 
          contentId={lineItem.sys.id} 
          fieldName="startTime" 
          displayValue={formatTime(lineItem.startTime)}
        />
      </td>
      <td>
        <VisualEditorComponent 
          contentId={lineItem.sys.id} 
          fieldName="endTime" 
          displayValue={formatTime(lineItem.endTime)}
        />
      </td>
      <td>
        <VisualEditorComponent contentId={lineItem.sys.id} fieldName="energyConsumed" />
      </td>
      <td>
        <VisualEditorComponent contentId={lineItem.sys.id} fieldName="unitPrice" />
      </td>
      <td>
        <VisualEditorComponent contentId={lineItem.sys.id} fieldName="amount" />
      </td>
    </tr>
  );
};

InvoiceLineItem.propTypes = {
  lineItem: PropTypes.shape({
    sys: PropTypes.shape({
      id: PropTypes.string.isRequired,
    }).isRequired,
    date: PropTypes.string.isRequired,
    startTime: PropTypes.string.isRequired,
    endTime: PropTypes.string.isRequired,
    energyConsumed: PropTypes.string.isRequired,
    unitPrice: PropTypes.string.isRequired,
    amount: PropTypes.string.isRequired,
  }).isRequired,
};

export default InvoiceLineItem;
