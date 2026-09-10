import React from 'react';

import './BooEmptyState.css';

import booGreet from '../assets/boo/greet.png';
import booInquiry from '../assets/boo/inquiry.png';
import booReservation from '../assets/boo/reservation.png';
import booRest from '../assets/boo/rest.png';

const illustrations = {
  greet: booGreet,
  inquiry: booInquiry,
  reservation: booReservation,
  rest: booRest,
};

const BooEmptyState = ({
  title,
  description,
  action,
  variant = 'default',
  illustration = 'greet',
}) => (
  <div
    className={`boo-empty-state boo-empty-state--${variant} boo-empty-state--${illustration}`}>
    <div className="boo-empty-state__art" aria-hidden="true">
      <img
        src={illustrations[illustration] || booGreet}
        alt=""
        width={144}
        height={144}
        onError={event => {
          event.currentTarget.style.visibility = 'hidden';
        }}
      />
    </div>
    <div className="boo-empty-state__copy">
      <p className="boo-empty-state__title">{title}</p>
      {description && (
        <p className="boo-empty-state__description">{description}</p>
      )}
      {action && <div className="boo-empty-state__actions">{action}</div>}
    </div>
  </div>
);

export default BooEmptyState;
