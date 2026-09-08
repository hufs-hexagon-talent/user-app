import React, { useEffect, useRef, useState } from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Button, Modal } from 'flowbite-react';
import { ChevronLeft } from 'lucide-react';

import { useDeleteInquiry, useMyInquiries } from '../../api/inquiry.api';
import { useCustomSnackbars } from '../../components/snackbar/SnackBar';

import { inquiryErrorMessage } from './inquiryErrorMessage';
import { CATEGORY_LABELS, STATUS_LABELS } from './inquiryLabels';
import {
  STALE_MESSAGE,
  answerTitle,
  hasAnswer,
  metaLabel,
  retryState,
} from './inquiryView';

export const DETAIL_LOADING_MESSAGE = '문의를 불러오는 중입니다.';
export const DETAIL_ERROR_MESSAGE = '문의를 불러오지 못했습니다.';

const retryLinkClass =
  'inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-bold text-[#002D56] hover:underline';

const InquiryDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    data: inquiries,
    isPending,
    isError,
    isFetching,
    isPaused,
    refetch,
  } = useMyInquiries();
  const retry = retryState({ isFetching, isPaused });
  const { mutateAsync: deleteInquiry, isPending: isDeleting } =
    useDeleteInquiry();
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();
  // isPending 은 다음 렌더에서야 true 가 되어 같은 tick 의 두 번째 클릭을 막지 못한다.
  // 실제 차단은 동기 래치가 한다(CheckRoom.jsx 관례).
  const deletingRef = useRef(false);
  const [openModal, setOpenModal] = useState(false);

  // 목록이 손에 있으면 isError 여도 목록을 쓴다 — react-query v5 는 재조회가 실패해도 data 를
  // 유지하므로, 오류를 먼저 보면 이미 받은 답변을 화면에서 지우게 된다(목록 화면과 같은 순서).
  const hasList = !isPending && Array.isArray(inquiries);
  // 단건 조회 API 가 없다. 목록 캐시에서 꺼내 쓴다(/inquiry/:id/edit 와 같은 방식).
  const inquiry = hasList
    ? inquiries.find(item => String(item.inquiryId) === id)
    : null;

  // 대상이 없으면(직접 주소 접근·이미 삭제됨·잘못된 번호) 목록으로 돌려보낸다. 폼과 달리
  // replace 를 쓴다 — 죽은 주소가 히스토리에 남으면 뒤로가기가 곧바로 되튕겨 아무 일도
  // 일어나지 않은 것처럼 보인다.
  useEffect(() => {
    if (!hasList) return;
    if (!inquiry) navigate('/inquiry', { replace: true });
  }, [hasList, inquiry, navigate]);

  const handleDelete = async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    let deleted = false;
    try {
      await deleteInquiry(inquiry.inquiryId);
      deleted = true;
      openSuccessSnackbar('문의를 삭제했습니다.', 3000);
    } catch (error) {
      const message = inquiryErrorMessage(error);
      if (message) openErrorSnackbar(message, 3000);
    } finally {
      deletingRef.current = false;
    }
    setOpenModal(false);
    if (deleted) navigate('/inquiry', { replace: true });
  };

  const shell = children => (
    <div className="px-4 sm:px-8 py-8 max-w-2xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/inquiry')}
        className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm text-gray-600 hover:underline">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />내 문의
      </button>
      {children}
    </div>
  );

  if (isPending) {
    return shell(
      <p className="py-16 text-center text-gray-500">
        {DETAIL_LOADING_MESSAGE}
      </p>,
    );
  }

  if (!hasList) {
    return shell(
      <div className="py-16 text-center text-gray-500">
        {DETAIL_ERROR_MESSAGE}
        <div className="mt-4 flex justify-center">
          <Button size="sm" color="dark" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      </div>,
    );
  }

  // 리다이렉트는 effect 에서 일어난다. 그 한 프레임 동안 빈 화면을 그린다.
  if (!inquiry) return shell(null);

  const isResolved = inquiry.status === 'RESOLVED';
  const meta = metaLabel(inquiry);
  const answered = hasAnswer(inquiry);

  return shell(
    <>
      {isError && (
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

      <div className="mb-4 flex items-start justify-between gap-3 break-keep">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-black">
            {CATEGORY_LABELS[inquiry.category]}
          </h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isResolved
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-200 text-gray-700'
            }`}>
            {STATUS_LABELS[inquiry.status]}
          </span>
        </div>
        <span className="mt-1 text-xs text-gray-500 whitespace-nowrap">
          {format(new Date(inquiry.createAt), 'yyyy-MM-dd HH:mm')}
        </span>
      </div>

      {/* 학생은 답변을 보러 들어온다. 답변이 본문보다 먼저 온다. */}
      {answered && (
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-600">
            {answerTitle(inquiry)}
          </p>
          <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">
            {inquiry.adminMemo}
          </p>
        </div>
      )}

      {meta && <p className="mt-4 text-xs text-gray-500">{meta}</p>}

      {/* 뒤로 링크가 "내 문의"(목록 제목)라 본문 라벨은 "문의 내용" 으로 둔다. "관리자 답변" 과도 짝이 맞다. */}
      <p className="mt-4 text-xs font-semibold text-gray-600">문의 내용</p>
      <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words break-keep">
        {inquiry.content}
      </p>

      {!isResolved && (
        <div className="mt-6 flex justify-end gap-3 text-sm">
          <button
            type="button"
            onClick={() => navigate(`/inquiry/${inquiry.inquiryId}/edit`)}
            className="inline-flex min-h-[44px] items-center px-2 text-blue-600 hover:underline">
            수정
          </button>
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="inline-flex min-h-[44px] items-center px-2 text-red-600 hover:underline">
            삭제
          </button>
        </div>
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
                  onClick={handleDelete}>
                  확인
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>
      </div>
    </>,
  );
};

export default InquiryDetail;
