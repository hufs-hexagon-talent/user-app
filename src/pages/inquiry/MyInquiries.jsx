import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from 'flowbite-react';
import { ChevronRight } from 'lucide-react';

import { useMyInquiries } from '../../api/inquiry.api';

import { CATEGORY_LABELS, STATUS_LABELS } from './inquiryLabels';
import {
  hasAnswer,
  metaLabel,
  sortResolvedLatestFirst,
  STALE_MESSAGE,
} from './inquiryView';

const newInquiryButtonClass =
  'rounded-md bg-[#002D56] px-4 py-2 text-white text-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
const retryLinkClass =
  'inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-bold text-[#002D56] hover:underline';
const rowClass =
  'flex w-full min-h-[44px] items-center gap-3 rounded-md border p-4 text-left break-keep hover:bg-gray-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';

const formatAt = value => format(new Date(value), 'yyyy-MM-dd HH:mm');

const MyInquiries = () => {
  const navigate = useNavigate();
  const { data: inquiries, isPending, isError, refetch } = useMyInquiries();

  // 분기 순서: 목록이 손에 있으면 isError 여도 목록을 그린다 — react-query v5 는 재조회가
  // 실패해도 data 를 유지하므로, 오류를 먼저 보면 이미 받은 답변을 화면에서 지우게 된다.
  const hasList = !isPending && Array.isArray(inquiries);
  const list = hasList ? inquiries : [];
  // 서버가 접수일 내림차순으로 준다. 답변 대기는 그대로, 답변 완료는 답변한 순서로.
  const open = list.filter(inquiry => inquiry.status !== 'RESOLVED');
  const resolved = sortResolvedLatestFirst(
    list.filter(inquiry => inquiry.status === 'RESOLVED'),
  );

  // 목록은 훑는 화면이다. 답변도 본문도 여기서는 펼치지 않는다 — 긴 문의 한 건이 화면을
  // 통째로 먹으면 새 답변이 눈에 띄지 않는다. 전문은 상세(/inquiry/:id)에서 읽는다.
  const renderRow = inquiry => {
    const isResolved = inquiry.status === 'RESOLVED';
    const meta = metaLabel(inquiry);
    // 배지가 이미 "답변 완료" 를 말한다. 표시가 필요한 곳은 재오픈뿐이다 — 거기서만
    // 배지(답변 대기)와 실제 상태(답변 있음)가 어긋난다.
    const showAnswerChip = !isResolved && hasAnswer(inquiry);
    const createdAt = formatAt(inquiry.createAt);

    return (
      <li key={inquiry.inquiryId}>
        {/* 클램프한 본문이 접근 이름에 그대로 실리면 400자가 읽힌다. 이름은 따로 준다. */}
        <button
          type="button"
          onClick={() => navigate(`/inquiry/${inquiry.inquiryId}`)}
          aria-label={`${CATEGORY_LABELS[inquiry.category]} ${
            STATUS_LABELS[inquiry.status]
          } ${createdAt} 문의 보기`}
          className={rowClass}>
          {/* flex 아이템의 기본 min-width: auto 는 콘텐츠 최소 크기보다 작아지지 않는다.
              0 으로 내려야 긴 본문이 행을 오른쪽으로 늘리지 않는다. */}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {CATEGORY_LABELS[inquiry.category]}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isResolved
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                {STATUS_LABELS[inquiry.status]}
              </span>
              {showAnswerChip && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  이전 답변
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500 whitespace-nowrap">
                {createdAt}
              </span>
            </span>
            {meta && (
              <span className="mt-1 block text-xs text-gray-500">{meta}</span>
            )}
            <span className="mt-1 block text-sm text-gray-800 line-clamp-2 break-words">
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
            className={retryLinkClass}>
            다시 시도
          </button>
        </div>
      )}

      {hasList && list.length === 0 && (
        <div className="text-center text-gray-500 py-16">
          접수한 문의가 없습니다.
        </div>
      )}

      {/* 두 섹션 모두 제목을 갖고 접지 않는다. 행이 짧아 접을 이유가 없다. */}
      {open.length > 0 && (
        <section aria-labelledby="open-inquiries-heading" className="mb-8">
          <h2
            id="open-inquiries-heading"
            className="mb-3 text-lg font-bold text-black">
            답변 대기 {open.length}건
          </h2>
          <ul className="space-y-3">{open.map(renderRow)}</ul>
        </section>
      )}

      {resolved.length > 0 && (
        <section aria-labelledby="resolved-inquiries-heading">
          <h2
            id="resolved-inquiries-heading"
            className="mb-3 text-lg font-bold text-black">
            답변 완료 {resolved.length}건
          </h2>
          <ul className="space-y-3">{resolved.map(renderRow)}</ul>
        </section>
      )}
    </div>
  );
};

export default MyInquiries;
