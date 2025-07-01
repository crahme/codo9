// src/components/InvoiceLineItem.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function InvoiceLineItem({ lineItem }) {
  if (!lineItem) return null;
  return (
    <tr>
      <td>{lineItem.date ? new Date(lineItem.date).toLocaleDateString() : ''}</td>
      <td>{lineItem.startTime || ''}</td>
      <td>{lineItem.endTime || ''}</td>
      <td>{lineItem.energyConsumed || ''}</td>
      <td>{lineItem.unitPrice || ''}</td>
      <td>{lineItem.amount || ''}</td>
    </tr>
  );
}

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
