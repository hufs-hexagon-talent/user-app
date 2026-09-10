import React from 'react';

import './UsageSummaryCard.css';

import booGreet from '../../assets/boo/greet.png';

const UsageSummaryCard = ({ summary, isPending, isError, onRetry }) => {
  const hasSummary = summary != null;
  const hours = hasSummary ? Math.floor(summary.totalMinutes / 60) : 0;
  const minutes = hasSummary ? summary.totalMinutes % 60 : 0;
  const durationLabel = [
    hours > 0 ? `${hours.toLocaleString('ko-KR')}시간` : null,
    minutes > 0 || hours === 0 ? `${minutes}분` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const retryButton = (
    <button
      type="button"
      className="usage-summary-card__retry"
      onClick={onRetry}>
      다시 시도
    </button>
  );

  return (
    <section className="usage-summary-card" aria-label="세미나실 이용 기록">
      <h2 className="usage-summary-card__title">세미나실에서 쌓은 시간</h2>
      <div className="usage-summary-card__main">
        <div className="usage-summary-card__record">
          {hasSummary ? (
            summary.visitCount === 0 ? (
              <p className="usage-summary-card__empty">
                첫 기록을 기다리고 있어요
              </p>
            ) : (
              <>
                <p
                  className="usage-summary-card__duration"
                  aria-label={durationLabel}>
                  {hours > 0 && (
                    <span className="usage-summary-card__amount">
                      <strong>{hours.toLocaleString('ko-KR')}</strong>
                      <span>시간</span>
                    </span>
                  )}
                  {(minutes > 0 || hours === 0) && (
                    <span className="usage-summary-card__amount">
                      <strong>{minutes}</strong>
                      <span>분</span>
                    </span>
                  )}
                </p>
                <p className="usage-summary-card__count">
                  지금까지{' '}
                  <strong>
                    {summary.visitCount.toLocaleString('ko-KR')}회
                  </strong>{' '}
                  출석했어요
                </p>
              </>
            )
          ) : isError ? (
            <div className="usage-summary-card__feedback" role="status">
              <p>이용 기록을 불러오지 못했어요.</p>
              {retryButton}
            </div>
          ) : (
            <p
              className="usage-summary-card__loading"
              role="status"
              aria-busy={isPending}>
              이용 기록을 불러오는 중이에요.
            </p>
          )}
        </div>
        <img
          className="usage-summary-card__boo"
          src={booGreet}
          alt=""
          onError={event => {
            event.currentTarget.style.visibility = 'hidden';
          }}
        />
      </div>
      {hasSummary && isError && (
        <div
          className="usage-summary-card__feedback usage-summary-card__feedback--stale"
          role="status">
          <p>최신 기록을 못 받아왔어요.</p>
          {retryButton}
        </div>
      )}
      <p className="usage-summary-card__caption">출석한 예약 시간 기준</p>
    </section>
  );
};

export default UsageSummaryCard;
