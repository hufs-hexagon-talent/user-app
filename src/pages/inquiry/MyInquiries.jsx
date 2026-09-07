import React, { useRef, useState } from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Button, Modal } from 'flowbite-react';

import { useDeleteInquiry, useMyInquiries } from '../../api/inquiry.api';
import { useCustomSnackbars } from '../../components/snackbar/SnackBar';

import { inquiryErrorMessage } from './inquiryErrorMessage';
import { CATEGORY_LABELS, STATUS_LABELS } from './inquiryLabels';
import { metaLabel, sortResolvedLatestFirst } from './inquiryView';

export const STALE_MESSAGE = '최신 상태를 못 받아왔습니다.';

const newInquiryButtonClass =
  'rounded-md bg-[#002D56] px-4 py-2 text-white text-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
const retryLinkClass =
  'inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-bold text-[#002D56] hover:underline';

const formatAt = value => format(new Date(value), 'yyyy-MM-dd HH:mm');

// 관리자 글은 제목이 있는 박스로. "메모" 는 관리자 DB 용어라 학생 화면에서 쓰지 않는다.
const AnswerBox = ({ title, text }) => (
  <div className="mt-2 rounded-md bg-gray-50 p-3">
    <p className="text-xs font-semibold text-gray-600">{title}</p>
    <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">
      {text}
    </p>
  </div>
);

const MyInquiries = () => {
  const navigate = useNavigate();
  const { data: inquiries, isPending, isError, refetch } = useMyInquiries();
  const { mutateAsync: deleteInquiry, isPending: isDeleting } =
    useDeleteInquiry();
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();
  // isPending 은 다음 렌더에서야 true 가 되어 같은 tick 의 두 번째 클릭을 막지 못한다.
  // 실제 차단은 동기 래치가 한다(CheckRoom.jsx 관례).
  const deletingRef = useRef(false);
  const [openModal, setOpenModal] = useState(false);

  const handleDelete = async inquiryId => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    try {
      await deleteInquiry(inquiryId);
      openSuccessSnackbar('문의를 삭제했습니다.', 3000);
    } catch (error) {
      const message = inquiryErrorMessage(error);
      if (message) openErrorSnackbar(message, 3000);
    } finally {
      deletingRef.current = false;
    }
    setOpenModal(false);
  };

  // 분기 순서: 목록이 손에 있으면 isError 여도 목록을 그린다 — react-query v5 는 재조회가
  // 실패해도 data 를 유지하므로, 오류를 먼저 보면 이미 받은 답변을 화면에서 지우게 된다.
  const hasList = !isPending && Array.isArray(inquiries);
  const list = hasList ? inquiries : [];
  // 서버가 접수일 내림차순으로 준다. 답변 대기는 그대로, 답변 완료는 답변한 순서로.
  const open = list.filter(inquiry => inquiry.status !== 'RESOLVED');
  const resolved = sortResolvedLatestFirst(
    list.filter(inquiry => inquiry.status === 'RESOLVED'),
  );

  const renderCard = inquiry => {
    const isResolved = inquiry.status === 'RESOLVED';
    const meta = metaLabel(inquiry);
    // 재오픈된 문의(OPEN + adminMemo)도 답변을 숨기지 않는다. 답변 시각을 담는 필드가 없어
    // 재오픈 답변에는 시각을 붙이지 않는다(updateAt 은 마지막 수정 시각일 뿐이다).
    let answerTitle = '이전 답변';
    if (isResolved) {
      answerTitle = inquiry.resolvedAt
        ? `관리자 답변 · ${formatAt(inquiry.resolvedAt)}`
        : '관리자 답변';
    }
    const hasAnswer = Boolean(inquiry.adminMemo);

    return (
      <li key={inquiry.inquiryId} className="border rounded-md p-4 break-keep">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
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
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {formatAt(inquiry.createAt)}
          </span>
        </div>

        {hasAnswer && (
          <AnswerBox title={answerTitle} text={inquiry.adminMemo} />
        )}

        {meta && <p className="mt-2 text-xs text-gray-500">{meta}</p>}

        {hasAnswer && (
          <p className="mt-2 text-xs font-semibold text-gray-600">내 문의</p>
        )}
        {/* 답변 완료 문의는 본문을 끝까지 읽을 다른 길이 없어 전문을 보여준다. 답변 대기는
            수정 화면에서 전문이 읽히므로 클램프를 유지한다. */}
        <p
          className={
            isResolved
              ? 'mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words'
              : 'mt-1 text-sm text-gray-800 line-clamp-2'
          }>
          {inquiry.content}
        </p>

        {!isResolved && (
          <div className="mt-3 flex justify-end gap-3 text-sm">
            <button
              type="button"
              onClick={() => navigate(`/inquiry/${inquiry.inquiryId}/edit`)}
              className="text-blue-600 hover:underline">
              수정
            </button>
            <button
              type="button"
              onClick={() => setOpenModal(inquiry.inquiryId)}
              className="text-red-600 hover:underline">
              삭제
            </button>
          </div>
        )}
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

      {/* 두 섹션 모두 제목을 갖고 접지 않는다. 1인 문의는 한 자릿수라 접을 이유가 없고,
          접힌 채로 열리면 새 답변을 놓친다. */}
      {open.length > 0 && (
        <section aria-labelledby="open-inquiries-heading" className="mb-8">
          <h2
            id="open-inquiries-heading"
            className="mb-3 text-lg font-bold text-black">
            답변 대기 {open.length}건
          </h2>
          <ul className="space-y-4">{open.map(renderCard)}</ul>
        </section>
      )}

      {resolved.length > 0 && (
        <section aria-labelledby="resolved-inquiries-heading">
          <h2
            id="resolved-inquiries-heading"
            className="mb-3 text-lg font-bold text-black">
            답변 완료 {resolved.length}건
          </h2>
          <ul className="space-y-4">{resolved.map(renderCard)}</ul>
        </section>
      )}

      <div className="flex justify-center items-center">
        <Modal
          className="flex justify-center items-center w-full p-4 sm:p-0"
          show={openModal}
          size="md"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClose={() => setOpenModal(false)}
          popup>
          <Modal.Header />
          <Modal.Body>
            <div className="text-center">
              <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
              <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                해당 문의를 삭제하시겠습니까?
              </h3>
              <div className="flex justify-center gap-4">
                <Button color="gray" onClick={() => setOpenModal(false)}>
                  취소
                </Button>
                <Button
                  color="failure"
                  disabled={isDeleting}
                  onClick={() => handleDelete(openModal)}>
                  확인
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>
      </div>
    </div>
  );
};

export default MyInquiries;
