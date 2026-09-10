import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from 'flowbite-react';
import { ChevronRight } from 'lucide-react';

import { useMyInquiries } from '../../api/inquiry.api';
import BooEmptyState from '../../components/BooEmptyState';

import { CATEGORY_LABELS, STATUS_LABELS } from './inquiryLabels';
import InquiryHistoryDrawer from './InquiryHistoryDrawer';
import {
  hasAnswer,
  metaLabel,
  retryState,
  rowDate,
  rowMeta,
  sortResolvedLatestFirst,
  STALE_MESSAGE,
} from './inquiryView';

const newInquiryButtonClass =
  'rounded-md bg-[#002D56] px-4 py-2 text-white text-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
const retryLinkClass =
  'inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-bold text-[#002D56] hover:underline';
const rowClass =
  'flex w-full min-h-[44px] items-center gap-3 rounded-md border p-3 text-left break-keep hover:bg-gray-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
const PREVIEW_COUNT = 3;

const formatAt = value => format(new Date(value), 'yyyy-MM-dd HH:mm');

const MyInquiries = () => {
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStatus, setHistoryStatus] = useState('OPEN');
  const {
    data: inquiries,
    isPending,
    isError,
    isFetching,
    isPaused,
    refetch,
  } = useMyInquiries();
  const retry = retryState({ isFetching, isPaused });

  // 분기 순서: 목록이 손에 있으면 isError 여도 목록을 그린다 — react-query v5 는 재조회가
  // 실패해도 data 를 유지하므로, 오류를 먼저 보면 이미 받은 답변을 화면에서 지우게 된다.
  const hasList = !isPending && Array.isArray(inquiries);
  const list = hasList ? inquiries : [];
  // 구획의 최근 3건과 전체 이력이 같은 순서를 쓴다. 서버가 주는 배열 순서에는 의존하지 않는다.
  const open = list
    .filter(inquiry => inquiry.status !== 'RESOLVED')
    .sort((a, b) => new Date(b.createAt) - new Date(a.createAt));
  const resolved = sortResolvedLatestFirst(
    list.filter(inquiry => inquiry.status === 'RESOLVED'),
  );
  const openHistory = status => {
    setHistoryStatus(status);
    setHistoryOpen(true);
  };

  // 목록은 훑는 화면이다. 답변도 본문도 여기서는 펼치지 않는다 — 긴 문의 한 건이 화면을
  // 통째로 먹으면 새 답변이 눈에 띄지 않는다. 전문은 상세(/inquiry/:id)에서 읽는다.
  const renderRow = (inquiry, inDrawer = false) => {
    const isResolved = inquiry.status === 'RESOLVED';
    const meta = metaLabel(inquiry);
    const metaParts = rowMeta(inquiry);
    const metaId = `${inDrawer ? 'history' : 'preview'}-inquiry-meta-${inquiry.inquiryId}`;
    // 배지가 이미 "답변 완료" 를 말한다. 표시가 필요한 곳은 재오픈뿐이다 — 거기서만
    // 배지(답변 대기)와 실제 상태(답변 있음)가 어긋난다.
    const showAnswerChip = !isResolved && hasAnswer(inquiry);
    // 답변 완료는 답변 시각, 그 외는 접수 시각 — 정렬 키와 같은 값을 라벨과 함께 찍는다.
    const { label: dateLabel, at } = rowDate(inquiry);
    const rowAt = formatAt(at);

    return (
      <li key={inquiry.inquiryId}>
        {/* 클램프한 본문이 접근 이름에 그대로 실리면 400자가 읽힌다. 이름은 따로 준다.
            대신 aria-label 이 안쪽 텍스트를 통째로 덮으므로, 눈에 보이는 표시를 늘리면
            여기에도 같이 실어야 한다 — 안 그러면 스크린리더만 그 표시를 못 받는다. */}
        <button
          type="button"
          onClick={() => navigate(`/inquiry/${inquiry.inquiryId}`)}
          aria-label={`${CATEGORY_LABELS[inquiry.category]} ${
            STATUS_LABELS[inquiry.status]
          }${showAnswerChip ? ' 이전 답변' : ''} ${dateLabel}일 ${rowAt} 문의 보기`}
          aria-describedby={meta ? metaId : undefined}
          className={`${rowClass}${inDrawer ? '' : ' sm:p-4'}`}>
          {/* flex 아이템의 기본 min-width: auto 는 콘텐츠 최소 크기보다 작아지지 않는다.
              0 으로 내려야 긴 본문이 행을 오른쪽으로 늘리지 않는다. */}
          <span className="min-w-0 flex-1">
            <span
              className={`flex flex-col gap-1${inDrawer ? '' : ' sm:flex-row sm:items-center sm:gap-2'}`}>
              <span className="flex h-5 items-center justify-between gap-2 whitespace-nowrap">
                <span className="text-sm font-semibold text-gray-900">
                  {CATEGORY_LABELS[inquiry.category]}
                </span>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                    isResolved
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                  {STATUS_LABELS[inquiry.status]}
                </span>
              </span>
              <span
                className={`flex h-5 items-center justify-between gap-2 whitespace-nowrap${inDrawer ? '' : ' sm:flex-1'}`}>
                <span>
                  {showAnswerChip && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      이전 답변
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-500">
                  {dateLabel} {rowAt}
                </span>
              </span>
            </span>
            {/* 메타가 없어도 같은 공간을 확보한다. 좁은 화면에서만 날짜·시간과 호실을 두 줄로 나눈다. */}
            <span
              className={`mt-1 grid h-10 grid-rows-2 items-center text-[13px] leading-5 text-gray-700${inDrawer ? '' : ' sm:flex sm:h-5 sm:gap-3'}`}>
              {metaParts?.fallback ? (
                <span
                  className={`row-span-2 line-clamp-2 break-words${inDrawer ? '' : ' sm:line-clamp-1'}`}
                  title={meta}>
                  {metaParts.fallback}
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-2 whitespace-nowrap tabular-nums">
                    {metaParts?.date && (
                      <>
                        <span className="text-xs text-gray-600">
                          {metaParts.label}
                        </span>
                        <span>{metaParts.date}</span>
                        <span className="font-semibold text-gray-900">
                          {metaParts.time}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                    {metaParts?.room && (
                      <>
                        <span className="shrink-0 text-xs text-gray-600">
                          호실
                        </span>
                        <span
                          className="truncate font-semibold text-[#002D56]"
                          title={metaParts.room}>
                          {metaParts.room}
                        </span>
                      </>
                    )}
                    {metaParts?.notice && (
                      <span className="shrink-0 text-xs text-gray-600">
                        {metaParts.notice}
                      </span>
                    )}
                  </span>
                </>
              )}
            </span>
            {meta && (
              <span id={metaId} className="sr-only">
                {meta}
              </span>
            )}
            <span className="mt-1 block h-5 truncate text-sm text-gray-800">
              {inquiry.content}
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-gray-400"
          />
        </button>
      </li>
    );
  };

  const queryNotice = (
    <>
      {isPending && (
        <div className="text-center text-gray-500 py-16">
          문의 목록을 불러오는 중입니다.
        </div>
      )}

      {!isPending && !hasList && isError && (
        <div className="text-center text-gray-500 py-16">
          문의 목록을 불러오지 못했습니다.
          <div className="mt-4 flex justify-center">
            <Button size="sm" color="dark" onClick={() => refetch()}>
              다시 시도
            </Button>
          </div>
        </div>
      )}

      {hasList && isError && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <span>{STALE_MESSAGE}</span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={retry.disabled}
            className={retryLinkClass}>
            {retry.label}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="px-4 sm:px-8 py-8 max-w-2xl mx-auto">
      {/* 문의하기 버튼은 로딩·실패·빈 목록에서도 항상 그린다. 목록 API 가 죽어도 접수 경로가
          살아 있어야 한다(폼은 이 API 에 의존하지 않는다). */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-2xl text-black">내 문의</h1>
        <button
          type="button"
          onClick={() => navigate('/inquiry/new')}
          className={newInquiryButtonClass}>
          문의하기
        </button>
      </div>

      {queryNotice}

      {hasList && !isError && list.length === 0 && (
        <BooEmptyState
          illustration="inquiry"
          title="접수한 문의가 없습니다."
          description="출석 문제나 이용 중 불편한 점은 문의하기로 알려 주세요."
        />
      )}

      {/* 최근 문의는 바로 보여주고, 오래된 이력은 같은 구획의 전체 보기로 이어진다. */}
      {open.length > 0 && (
        <section aria-labelledby="open-inquiries-heading" className="mb-8">
          <div className="mb-3 flex min-h-[44px] items-center justify-between gap-3">
            <h2
              id="open-inquiries-heading"
              className="text-lg font-bold text-black">
              답변 대기 {open.length}건
            </h2>
            {open.length > PREVIEW_COUNT && (
              <button
                type="button"
                aria-label="답변 대기 전체 보기"
                aria-haspopup="dialog"
                onClick={() => openHistory('OPEN')}
                className={`${retryLinkClass} text-sm`}>
                전체 보기
              </button>
            )}
          </div>
          <ul className="space-y-3">
            {open.slice(0, PREVIEW_COUNT).map(inquiry => renderRow(inquiry))}
          </ul>
        </section>
      )}

      {resolved.length > 0 && (
        <section aria-labelledby="resolved-inquiries-heading">
          <div className="mb-3 flex min-h-[44px] items-center justify-between gap-3">
            <h2
              id="resolved-inquiries-heading"
              className="text-lg font-bold text-black">
              답변 완료 {resolved.length}건
            </h2>
            {resolved.length > PREVIEW_COUNT && (
              <button
                type="button"
                aria-label="답변 완료 전체 보기"
                aria-haspopup="dialog"
                onClick={() => openHistory('RESOLVED')}
                className={`${retryLinkClass} text-sm`}>
                전체 보기
              </button>
            )}
          </div>
          <ul className="space-y-3">
            {resolved
              .slice(0, PREVIEW_COUNT)
              .map(inquiry => renderRow(inquiry))}
          </ul>
        </section>
      )}
      <InquiryHistoryDrawer
        open={historyOpen}
        status={historyStatus}
        onStatusChange={setHistoryStatus}
        onClose={() => setHistoryOpen(false)}
        openInquiries={open}
        resolvedInquiries={resolved}
        hasList={hasList}
        showEmptyState={!isError || list.length > 0}
        notice={queryNotice}
        renderRow={inquiry => renderRow(inquiry, true)}
      />
    </div>
  );
};

export default MyInquiries;
