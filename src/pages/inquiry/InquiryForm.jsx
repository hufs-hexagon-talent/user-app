import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';

import {
  useCreateInquiry,
  useMyInquiries,
  useUpdateInquiry,
} from '../../api/inquiry.api';
import { useUserReservation } from '../../api/reservation.api';
import { useInquiryRooms } from '../../api/room.api';
import { useCustomSnackbars } from '../../components/snackbar/SnackBar';

import { inquiryErrorMessage } from './inquiryErrorMessage';
import { CATEGORY_HINTS, CATEGORY_LABELS } from './inquiryLabels';
import { occurredAtProblem, toDateTimeLocal, toInstant } from './occurredAt';
import ReservationCard from './ReservationCard';
import ReservationPickerModal from './ReservationPickerModal';
import {
  formatReservationTime,
  formatRoom,
  linkedReservationLabel,
  reservationStateLabel,
} from './reservationView';

const CONTENT_MAX_LENGTH = 1000;
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS);

// 서버에 연결 해제가 없다(수정의 reservationId null = 기존 연결 유지). 접수에서는 "선택 해제"
// 를 배웠는데 수정에서 사라지면 버튼을 찾아 헤매므로, 제약을 화면에 적는다.
export const LINKED_RESERVATION_HINT =
  '연결한 예약은 다른 예약으로 바꿀 수만 있습니다';
export const ROOMS_LOADING_MESSAGE = '방 목록을 불러오는 중입니다.';
export const ROOMS_UNAVAILABLE_MESSAGE =
  '방 목록을 불러오지 못했습니다. 내용에 방 번호를 적어 주세요.';
export const DEEP_LINK_PENDING_MESSAGE = '예약을 확인하는 중입니다.';
export const DEEP_LINK_MISSING_MESSAGE =
  '링크로 받은 예약을 찾지 못했습니다. 아래에서 골라 주세요.';
export const DEEP_LINK_ERROR_MESSAGE = '예약을 불러오지 못했습니다.';
export const EDIT_LOADING_MESSAGE = '문의를 불러오는 중입니다.';
export const OCCURRED_AT_HINT = '시간을 모르면 비워 두세요.';
export const CONTENT_PLACEHOLDERS = {
  ATTENDANCE: '예: 14시에 QR을 찍었는데 미출석으로 표시됩니다.',
  FACILITY: '예: 문 옆 키오스크 화면이 켜지지 않습니다.',
  ETC: '예약 시간 연장, 이용 규칙, 계정 문제 등 자유롭게 적어 주세요.',
};

// Tailwind 는 소스를 정적으로 스캔한다 — 클래스 문자열은 조립하지 않고 완결된 리터럴로 둔다.
const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
// 제출·예약 선택은 가장 많이 눌리는 버튼인데 py-2 + text-sm 이라 36/38px 이었다. 44px 로 맞춘다.
const primaryButtonClass =
  'min-h-[44px] w-full rounded-md bg-[#002D56] px-4 py-2 text-sm text-white disabled:opacity-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
const outlineButtonClass =
  'min-h-[44px] rounded-md border border-[#002D56] bg-white px-4 py-2 text-sm font-semibold text-[#002D56] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
// 글자만 있는 보조 버튼이라 높이가 ~20px 이었다. 모달 카드와 같은 44px 탭 영역을 준다.
const linkButtonClass =
  'inline-flex min-h-[44px] items-center px-2 text-sm text-[#002D56] hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
// 유형 카드. 네이티브 radio 가 안에 있어 키보드·역할·선택 상태는 브라우저가 준다. 포커스 링은
// 16px radio 가 아니라 카드 전체에 그린다(has-[:focus-visible] — 마우스 클릭에는 안 켜진다).
const optionCardClass =
  'flex min-h-[56px] cursor-pointer items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-2 break-keep has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#002D56]';
const optionCardSelectedClass =
  'flex min-h-[56px] cursor-pointer items-center gap-3 rounded-md border border-[#002D56] bg-white px-3 py-2 break-keep shadow-[0_0_0_1.5px_#002D56] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#002D56]';
// 방 세그먼트. radio 는 sr-only 라 포커스 링은 label 에 그린다. 선택은 테두리 외에 체크 아이콘으로도
// 표시한다 — 포커스 링과 선택 테두리가 둘 다 남색이라 색·두께만으로는 가르기 어렵다.
const segmentClass =
  'flex min-h-[44px] cursor-pointer items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-800 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#002D56]';
const segmentSelectedClass =
  'flex min-h-[44px] cursor-pointer items-center justify-center gap-1 rounded-md border border-[#002D56] bg-white px-5 text-sm font-semibold text-[#002D56] shadow-[0_0_0_1.5px_#002D56] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#002D56]';

const parseCategory = value =>
  CATEGORY_OPTIONS.includes(value) ? value : null;
const parseReservationId = value =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null;

// CLIENT-001 은 errors[].field 로 어느 입력이 틀렸는지 알려준다.
const hasFieldError = (error, field) => {
  const errors = error?.response?.data?.errors;
  return Array.isArray(errors) && errors.some(item => item?.field === field);
};

const InquiryForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(id);
  // 딥링크(/check 표의 "문의" 링크)는 접수에서만 읽는다. 잘못된 값은 무시한다.
  const queryCategory = isEditMode
    ? null
    : parseCategory(searchParams.get('category'));
  const queryReservationId = isEditMode
    ? null
    : parseReservationId(searchParams.get('reservationId'));

  const { data: inquiries, isPending: isListPending } = useMyInquiries();
  const {
    data: reservations,
    isPending: isReservationsPending,
    isError: isReservationsError,
    isFetching: isReservationsFetching,
    isPaused: isReservationsPaused,
    refetch: refetchReservations,
  } = useUserReservation();
  const { mutateAsync: createInquiry, isPending: isCreating } =
    useCreateInquiry();
  const { mutateAsync: updateInquiry, isPending: isUpdating } =
    useUpdateInquiry();
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();
  // isPending 은 다음 렌더에서야 true 가 되어 같은 tick 의 두 번째 클릭을 막지 못한다.
  // 실제 차단은 동기 래치가 한다.
  const submittingRef = useRef(false);

  const inquiry = isEditMode
    ? inquiries?.find(item => String(item.inquiryId) === id)
    : null;
  // 예약이 학생 취소로 지워져 id 가 null 이어도 스냅샷이 남아 있으면 연결로 본다 —
  // 서버(InquiryCommandService.updateMine)는 예약도 스냅샷도 없을 때만 거절한다.
  const existingLink =
    isEditMode &&
    (inquiry?.reservationId != null || inquiry?.reservationSummary != null);

  // 유형은 기본값이 없다 — 시설 고장을 신고하러 온 학생이 "관련 예약 필수" 를 먼저 만나면 안 된다.
  const [category, setCategory] = useState(queryCategory);
  const [content, setContent] = useState('');
  // 모달에서 고른 예약 객체. id 만 두면 폼 안에 카드를 그릴 수 없다.
  const [pickedReservation, setPickedReservation] = useState(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // 기타(ETC)의 예약 연결은 접힌 영역이다. 토글 버튼은 언마운트하지 않는다(포커스 복귀).
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [roomId, setRoomId] = useState(null);
  // datetime-local 값(로컬 벽시계). 빈 값 = 지정 안 함.
  const [occurredAt, setOccurredAt] = useState('');
  // 딥링크 상태: pending(목록 기다림) → found | missing | error. null 이면 딥링크 없음.
  const [deepLinkStatus, setDeepLinkStatus] = useState(
    queryReservationId != null ? 'pending' : null,
  );

  const {
    data: rooms,
    isPending: isRoomsPending,
    isError: isRoomsError,
    refetch: refetchRooms,
  } = useInquiryRooms({ enabled: category === 'FACILITY' });

  // flowbite 모달(내부적으로 floating-ui)은 닫힐 때 "아직 DOM 에 붙어 있는" 원래 트리거로만
  // 포커스를 되돌린다. 예약을 고르면 트리거였던 "예약 선택" 버튼이 그 자리에서 사라져 되돌릴
  // 대상이 없어지고 포커스가 <body> 로 떨어졌다. 그래서 (1) 피커를 여는 주 버튼은 세 상태에서
  // 같은 엘리먼트로 두어 항상 연결돼 있게 하고, (2) 자기 자신을 언마운트하는 보조 버튼
  // (선택 해제·되돌리기·딥링크 다시 시도)과 선택 성공 경로에서는 여기서 직접 포커스를 옮긴다.
  const primaryButtonRef = useRef(null);
  const [focusPrimary, setFocusPrimary] = useState(false);
  useEffect(() => {
    if (!focusPrimary) return;
    primaryButtonRef.current?.focus();
    setFocusPrimary(false);
  }, [focusPrimary]);
  // 방 목록의 "다시 시도" 도 누르는 순간 안내 상자가 로딩 문구로 바뀌며 자기 자신을 지운다.
  // 항상 마운트돼 있는 방 fieldset 으로 포커스를 옮긴다.
  const roomsFieldsetRef = useRef(null);

  // 수정 모드 초기값: 캐시에서 찾은 문의로 문의당 한 번만 채운다. 포커스 재조회로 같은 문의의
  // 새 객체가 오면(관리자 답변 등) 참조가 바뀌는데, 그때마다 다시 채우면 고치던 내용이 서버 값으로
  // 되돌아간다. 기존 연결은 읽기 전용 스냅샷으로 따로 보여주므로 고른 예약은 비운다.
  const initializedInquiryId = useRef(null);
  useEffect(() => {
    if (!inquiry || initializedInquiryId.current === inquiry.inquiryId) return;
    initializedInquiryId.current = inquiry.inquiryId;
    setCategory(inquiry.category);
    setContent(inquiry.content ?? '');
    setPickedReservation(null);
    setRoomId(inquiry.roomId ?? null);
    setOccurredAt(toDateTimeLocal(inquiry.occurredAt));
    // 기존 연결이 있으면 펼친 채로 — 목록 카드가 보여주는 예약을 수정 화면이 숨기면 안 된다.
    setIsReservationOpen(
      inquiry.reservationId != null || inquiry.reservationSummary != null,
    );
  }, [inquiry]);

  // 수정 대상이 캐시에 없으면(직접 주소 접근·이미 삭제됨 등) 목록으로 돌려보낸다.
  useEffect(() => {
    if (!isEditMode || isListPending) return;
    if (!inquiry) navigate('/inquiry');
  }, [isEditMode, isListPending, inquiry, navigate]);

  // 딥링크: 목록이 로드된 뒤 한 번만 적용한다. isPending 이 최우선 — 로딩 중 find 실패를
  // "찾을 수 없음" 으로 보이면 주 흐름 전원이 오류 문구를 한 번 본다. 못 찾으면 피커를 열지 않는다.
  useEffect(() => {
    if (deepLinkStatus !== 'pending' || isReservationsPending) return;
    const found = Array.isArray(reservations)
      ? reservations.find(item => item.reservationId === queryReservationId)
      : null;
    if (found) {
      setPickedReservation(found);
      // 기타로 왔으면 펼친 채로 시작한다 — 접힌 영역 뒤에 숨은 예약이 제출되면 안 된다.
      setIsReservationOpen(true);
      setDeepLinkStatus('found');
      return;
    }
    setDeepLinkStatus(
      !Array.isArray(reservations) && isReservationsError ? 'error' : 'missing',
    );
  }, [
    deepLinkStatus,
    isReservationsPending,
    isReservationsError,
    reservations,
    queryReservationId,
  ]);

  const changeCategory = next => {
    setCategory(next);
    // 숨긴 값이 제출되지 않게 반대편 상태를 비운다(서버도 정리하지만 이중 방어).
    if (next === 'FACILITY') {
      setPickedReservation(null);
      setIsReservationOpen(false);
      return;
    }
    setRoomId(null);
    setOccurredAt('');
    // 기타로 오는데 고른·연결된 예약이 있으면 펼친 채로 — 출석에서 예약을 확정한 뒤 안내 문구를
    // 따라 기타로 바꾼 학생이 카드를 못 보는 채로 그 예약이 실려 나가면 안 된다.
    if (next === 'ETC' && (pickedReservation != null || existingLink)) {
      setIsReservationOpen(true);
    }
  };

  // 기타의 예약 영역을 접으면 고른 예약도 지운다 — 카드가 화면에서 사라졌는데 reservationId 가
  // 실려 나가면 학생이 보지도 지울 수도 없는 연결이 생긴다. 수정 모드의 기존 연결은 서버에
  // 이미 있고 목록 카드에도 보이므로 접기만 한다.
  const toggleReservationArea = () => {
    if (isReservationOpen && pickedReservation) setPickedReservation(null);
    setIsReservationOpen(open => !open);
  };

  const linkedLabel = existingLink ? linkedReservationLabel(inquiry) : null;
  const isFacility = category === 'FACILITY';
  const reservationRequired = category === 'ATTENDANCE';
  const hasReservation = pickedReservation != null || existingLink;
  const contentValid = content.trim().length > 0;
  const occurredProblem = isFacility ? occurredAtProblem(occurredAt) : null;
  // 분기 순서가 중요하다: 목록이 손에 있으면 재조회가 실패해도 세그먼트를 그린다(피커·내 문의
  // 목록과 같은 순서). react-query v5 는 재조회 실패 시 data 를 유지한 채 isError 만 켜는데,
  // 그때 안내 상자까지 같이 뜨면 세그먼트가 눈앞에 있는데도 방 없이 제출이 열린다.
  const roomsReady = Array.isArray(rooms) && rooms.length > 0;
  const roomsUnavailable =
    !roomsReady && (isRoomsError || Array.isArray(rooms));

  let fieldsValid = false;
  if (category === 'ATTENDANCE') fieldsValid = hasReservation;
  else if (isFacility)
    fieldsValid =
      !isRoomsPending &&
      (roomId != null || roomsUnavailable) &&
      !occurredProblem;
  else if (category === 'ETC') fieldsValid = true;
  const canSubmit = Boolean(category) && contentValid && fieldsValid;
  const selectedId =
    pickedReservation?.reservationId ?? inquiry?.reservationId ?? null;
  const isPending = isEditMode ? isUpdating : isCreating;

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!canSubmit) return;
    submittingRef.current = true;
    try {
      const payload = {
        category,
        content: content.trim(),
        // 시설 문의는 예약을 갖지 않는다. 그 외에서 null 은 접수 "연결 없음", 수정 "유지".
        reservationId:
          !isFacility && pickedReservation
            ? pickedReservation.reservationId
            : null,
        // 시설 문의 상태를 통째로 보낸다(수정에서는 교체 — null 이면 지움).
        // 방 목록 실패 시 roomId 에는 수정 초기값(기존 방)이 그대로 남아 있다.
        roomId: isFacility ? roomId : null,
        occurredAt: isFacility ? toInstant(occurredAt) : null,
      };

      if (isEditMode) {
        await updateInquiry({ inquiryId: inquiry.inquiryId, ...payload });
        openSuccessSnackbar('문의를 수정했습니다.', 3000);
      } else {
        await createInquiry(payload);
        openSuccessSnackbar('문의가 접수되었습니다.', 3000);
      }
      navigate('/inquiry');
    } catch (error) {
      const code = error?.response?.data?.code;
      const normalizedCode = typeof code === 'string' ? code.trim() : null;
      const message = inquiryErrorMessage(error);
      if (message) openErrorSnackbar(message, 3000);
      // 처리 완료된 문의는 더 이상 수정할 수 없다 — 목록으로 돌려보낸다.
      if (normalizedCode === 'INQUIRY-003') navigate('/inquiry');
      // 고른 예약이 그사이 사라졌다(취소·목록 갱신). 선택을 비우고 목록을 다시 읽어 같은
      // 실패를 되풀이하지 않게 한다. 문구는 inquiryErrorMessage 가 이미 낸다.
      if (normalizedCode === 'INQUIRY-002') {
        setPickedReservation(null);
        refetchReservations();
      }
      // 고른 방이 그사이 지워졌다. 문구가 "목록을 새로 고쳐 주세요" 라고 하니 화면도 그렇게 한다 —
      // 선택을 비우고 목록을 다시 읽지 않으면 같은 400 이 되풀이된다.
      if (normalizedCode === 'CLIENT-001' && hasFieldError(error, 'roomId')) {
        setRoomId(null);
        refetchRooms();
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const openPicker = () => setIsPickerOpen(true);

  // 보조 버튼은 자기 자신을 지우므로 누른 뒤 포커스를 주 버튼으로 옮긴다.
  const clearPicked = () => {
    setPickedReservation(null);
    setFocusPrimary(true);
  };

  if (isEditMode && isListPending) {
    return (
      <div className="px-4 sm:px-8 py-8 max-w-2xl mx-auto">
        <h1 className="font-bold text-2xl text-black mb-6">문의 수정</h1>
        <p className="py-16 text-center text-gray-500">
          {EDIT_LOADING_MESSAGE}
        </p>
      </div>
    );
  }

  // 관련 예약 영역(출석은 항상, 기타는 토글로). 내용(카드/스냅샷/없음)만 상태별로 갈리고,
  // 버튼 줄은 어떤 상태에서도 같은 자리에 그린다 — 주 버튼이 언마운트되지 않아야 모달이
  // 포커스를 되돌릴 곳을 잃지 않는다.
  let reservationContent = null;
  let primaryText = '예약 선택';
  let primaryLabel;
  let primaryDescribedBy = 'reservation-requirement';
  let primaryClass = outlineButtonClass;
  let secondaryButton = null;

  if (pickedReservation) {
    reservationContent = (
      <ReservationCard
        room={formatRoom(pickedReservation)}
        time={formatReservationTime(pickedReservation)}
        state={reservationStateLabel(pickedReservation)}
      />
    );
    primaryText = '변경';
    primaryLabel = '관련 예약 변경';
    primaryClass = linkButtonClass;
    if (existingLink) {
      secondaryButton = (
        <button
          type="button"
          aria-label="관련 예약 되돌리기"
          onClick={clearPicked}
          className={linkButtonClass}>
          되돌리기
        </button>
      );
    } else if (!reservationRequired) {
      // ATTENDANCE 에서는 해제하면 제출만 잠기는 막다른 버튼이라 그리지 않는다.
      secondaryButton = (
        <button
          type="button"
          aria-label="관련 예약 선택 해제"
          onClick={clearPicked}
          className={linkButtonClass}>
          선택 해제
        </button>
      );
    }
  } else if (existingLink) {
    reservationContent = (
      <>
        <div className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 break-keep">
          {/* 서버는 연결할 때 항상 스냅샷을 남기지만, 없으면 빈 상자가 되므로 대체 문구를 둔다. */}
          {linkedLabel ?? '연결된 예약'}
        </div>
        <p className="mt-1 text-xs text-gray-500">{LINKED_RESERVATION_HINT}</p>
      </>
    );
    primaryText = '다른 예약으로 변경';
    primaryDescribedBy = undefined;
    primaryClass = linkButtonClass;
  }

  // 내용이 없을 때는 "예약 선택" 버튼 하나뿐이라 원래대로 왼쪽에 둔다. 카드·스냅샷이 있으면
  // 그 아래 보조 버튼과 함께 오른쪽으로 붙인다. 두 갈래 모두 완결된 리터럴이다.
  const buttonsRowClass = reservationContent
    ? 'mt-2 flex justify-end gap-4'
    : 'flex justify-start';

  // 딥링크 안내는 예약을 고르기 전까지만 — 고른 카드 위에 "아래에서 골라 주세요" 가 남으면 안 된다.
  const showDeepLinkNotice = !pickedReservation;

  const reservationArea = (
    <div role="group" aria-label="관련 예약">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
        관련 예약
        <span
          id="reservation-requirement"
          className="text-xs font-normal text-gray-500">
          {reservationRequired ? '필수' : '선택'}
        </span>
      </p>
      {showDeepLinkNotice && deepLinkStatus === 'pending' && (
        <p className="mb-2 text-sm text-gray-500">
          {DEEP_LINK_PENDING_MESSAGE}
        </p>
      )}
      {showDeepLinkNotice && deepLinkStatus === 'missing' && (
        <p
          role="status"
          aria-live="polite"
          className="mb-2 text-sm text-gray-600 break-keep">
          {DEEP_LINK_MISSING_MESSAGE}
        </p>
      )}
      {showDeepLinkNotice && deepLinkStatus === 'error' && (
        <p
          role="status"
          aria-live="polite"
          className="mb-2 text-sm text-gray-600 break-keep">
          {DEEP_LINK_ERROR_MESSAGE}{' '}
          <button
            type="button"
            onClick={() => {
              // 이 버튼은 누르는 순간 "확인 중" 문구로 바뀌어 사라진다. 포커스는 주 버튼으로.
              setDeepLinkStatus('pending');
              refetchReservations();
              setFocusPrimary(true);
            }}
            className={linkButtonClass}>
            다시 시도
          </button>
        </p>
      )}
      {reservationContent}
      <div className={buttonsRowClass}>
        <button
          type="button"
          ref={primaryButtonRef}
          aria-label={primaryLabel}
          aria-describedby={primaryDescribedBy}
          onClick={openPicker}
          className={primaryClass}>
          {primaryText}
        </button>
        {secondaryButton}
      </div>
      {reservationRequired && (
        <p className="mt-1 text-sm text-gray-500">
          예약을 특정할 수 없는 출석 문제는 기타로
        </p>
      )}
    </div>
  );

  return (
    <div className="px-4 sm:px-8 py-8 max-w-2xl mx-auto">
      <h1 className="font-bold text-2xl text-black mb-6">
        {isEditMode ? '문의 수정' : '문의하기'}
      </h1>

      <div className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-900">
            어떤 문의인가요?
          </legend>
          <div className="space-y-2">
            {CATEGORY_OPTIONS.map(key => (
              <label
                key={key}
                className={
                  category === key ? optionCardSelectedClass : optionCardClass
                }>
                <input
                  type="radio"
                  name="category"
                  value={key}
                  checked={category === key}
                  onChange={() => changeCategory(key)}
                  className="h-4 w-4 accent-[#002D56] focus:outline-none"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">
                    {CATEGORY_LABELS[key]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {CATEGORY_HINTS[key]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {category === 'ATTENDANCE' && reservationArea}

        {isFacility && (
          <>
            <fieldset
              ref={roomsFieldsetRef}
              tabIndex={-1}
              className="rounded-md focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]">
              <legend className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                어느 방인가요?
                <span className="text-xs font-normal text-gray-500">필수</span>
              </legend>
              {isRoomsPending && (
                <p className="text-sm text-gray-500">{ROOMS_LOADING_MESSAGE}</p>
              )}
              {roomsUnavailable && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 break-keep">
                  <span>{ROOMS_UNAVAILABLE_MESSAGE}</span>
                  <button
                    type="button"
                    onClick={() => {
                      refetchRooms();
                      roomsFieldsetRef.current?.focus();
                    }}
                    className={linkButtonClass}>
                    다시 시도
                  </button>
                </div>
              )}
              {roomsReady && (
                <div className="flex flex-wrap gap-2">
                  {rooms.map(room => (
                    <label
                      key={room.roomId}
                      className={
                        roomId === room.roomId
                          ? segmentSelectedClass
                          : segmentClass
                      }>
                      <input
                        type="radio"
                        name="room"
                        value={room.roomId}
                        checked={roomId === room.roomId}
                        onChange={() => setRoomId(room.roomId)}
                        className="sr-only"
                      />
                      {roomId === room.roomId && (
                        <Check aria-hidden="true" className="h-4 w-4" />
                      )}
                      {room.roomName}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <div>
              <label
                htmlFor="occurredAt"
                className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                언제 그랬나요?
                <span className="text-xs font-normal text-gray-500">선택</span>
              </label>
              <input
                id="occurredAt"
                type="datetime-local"
                className={fieldClass}
                value={occurredAt}
                onChange={e => setOccurredAt(e.target.value)}
                aria-describedby={
                  occurredProblem
                    ? 'occurredAt-hint occurredAt-error'
                    : 'occurredAt-hint'
                }
                aria-invalid={Boolean(occurredProblem)}
              />
              <p id="occurredAt-hint" className="mt-1 text-xs text-gray-500">
                {OCCURRED_AT_HINT}
              </p>
              {occurredProblem && (
                <p
                  id="occurredAt-error"
                  role="alert"
                  className="mt-1 text-xs text-red-600">
                  {occurredProblem}
                </p>
              )}
            </div>
          </>
        )}

        {category === 'ETC' && (
          <div>
            <button
              type="button"
              aria-expanded={isReservationOpen}
              aria-controls={
                isReservationOpen ? 'etc-reservation-area' : undefined
              }
              onClick={toggleReservationArea}
              className={linkButtonClass}>
              관련 예약 연결(선택)
              <span aria-hidden="true" className="ml-1">
                {isReservationOpen ? '⌃' : '⌄'}
              </span>
            </button>
            {isReservationOpen && (
              <div id="etc-reservation-area" className="mt-2">
                {reservationArea}
              </div>
            )}
          </div>
        )}

        {category && (
          <div>
            <label
              htmlFor="content"
              className="mb-2 block text-sm font-medium text-gray-900">
              문의 내용
            </label>
            <textarea
              id="content"
              rows={6}
              maxLength={CONTENT_MAX_LENGTH}
              placeholder={CONTENT_PLACEHOLDERS[category]}
              className={fieldClass}
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            <p className="mt-1 text-right text-sm text-gray-500">
              {content.length} / {CONTENT_MAX_LENGTH}
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit || isPending}
          onClick={handleSubmit}
          className={primaryButtonClass}>
          {isEditMode ? '수정하기' : '제출하기'}
        </button>
      </div>

      <ReservationPickerModal
        show={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onPick={reservation => {
          setPickedReservation(reservation);
          // 한 번 고르면 딥링크 안내는 역할을 다했다. 남겨 두면 나중에 선택을 해제했을 때
          // "아래에서 골라 주세요" 가 되살아난다.
          setDeepLinkStatus(null);
          setFocusPrimary(true);
        }}
        selectedId={selectedId}
        category={category}
        reservations={reservations}
        isPending={isReservationsPending}
        isError={isReservationsError}
        isFetching={isReservationsFetching}
        isPaused={isReservationsPaused}
        refetch={refetchReservations}
      />
    </div>
  );
};

export default InquiryForm;
