import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker, { registerLocale } from 'react-datepicker';
import { Typography } from '@mui/material';
import {
  addMinutes,
  format,
  parse,
  isBefore,
  differenceInMinutes,
} from 'date-fns';

import Banner from '../../admin/banner/Banner';
import { ko } from 'date-fns/locale';
import { useSnackbar } from 'react-simple-snackbar';
import 'react-datepicker/dist/react-datepicker.css';
import { fetchDate } from '../../../api/policySchedule.api';
import { useReservations, useReserve } from '../../../api/reservation.api';
import useUrlQuery from '../../../hooks/useUrlQuery';
import useAuth from '../../../hooks/useAuth';
import { fetchBlockedPeriod, isAuthError } from '../../../api/user.api';
import {
  createTimeTable,
  getReserveErrorMessage,
  hasReservedSlotInRange,
  isOutsideOperationHours,
  maxMinutesExceededMessage,
  normalizeErrorCode,
  RESERVE_AUTH_FAILED_MESSAGE,
} from './reservationSlot';
import ReservationTimeTable from './ReservationTimeTable';
import { SLOT_INTERVAL_MINUTE } from './slotState';
import TimeTableLegend from './TimeTableLegend';
import SelectionBar from './SelectionBar';
import CustomButton from '../../../components/button/Button';
import { Button } from 'flowbite-react';
import { Modal } from 'flowbite-react';
import { durationLabel } from './durationLabel';
import { shortDateLabel } from './dateLabel';
import { modalTheme } from '../../../components/modal/modalTheme';
import BooEmptyState from '../../../components/BooEmptyState';

// 취소·예약 버튼(flowbite Button, node_modules/flowbite-react/dist/esm/components/Button/theme.mjs)
// 의 색은 theme.color 를 통째로 바꾼다 — className 으로 hover 색만 덧붙이면 theme.color.light/
// dark 기본 문자열에 남아 있는 dark:bg-gray-600 등 다크모드 클래스가 지워지지 않고 그대로
// 남는다(className 은 twMerge 순서상 맨 뒤라 같은 성질끼리만 덮어쓴다). 이 디자인은 다크모드가
// 없으므로 색 문자열 자체를 다크 변형 없이 새로 준다. 크기(50px·16px 반경 등)는 다크모드와
// 무관해 className 에 둔다.
// inner.base 기본값: "flex items-stretch transition-all duration-200" — 안쪽 <span> 을 버튼
// 정중앙에 놓도록 h-full/w-full/items-center/justify-center 로 바꾼다.
// size.md 기본값: "px-4 py-2 text-sm" — d5.css 의 padding:0, font-size:15px, font-weight:700,
// line-height:1 로 바꾼다(letter-spacing 은 바깥 button 클래스에 두면 상속되어 span 에도
// 적용된다).
const reserveActionButtonTheme = {
  color: {
    light:
      'border border-[#D9D4CD] bg-white text-[#39434F] shadow-none enabled:hover:border-[#CBC5BD] enabled:hover:bg-[#F7F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]',
    dark: 'border-0 bg-[#002D56] text-white shadow-[0_8px_18px_-9px_rgba(0,45,86,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] enabled:hover:bg-[#013C6E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]',
  },
  inner: {
    base: 'flex h-full w-full items-center justify-center',
  },
  size: {
    md: 'p-0 text-[15px] font-bold leading-none',
  },
};

const RoomPage = () => {
  // snackBar
  const [openSnackbar, closeSnackbar] = useSnackbar({
    position: 'top-right',
    style: {
      backgroundColor: '#FF3333',
    },
  });

  // react-simple-snackbar 는 매 렌더 새 함수를 돌려준다. 그대로 의존성에 넣으면
  // 아래 useCallback 들이 매번 새로 만들어져 표의 memo 가 무력해진다.
  const openSnackbarRef = useRef(openSnackbar);
  openSnackbarRef.current = openSnackbar;
  const showSnackbar = useCallback(message => {
    openSnackbarRef.current(message);
  }, []);

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedRangeFrom, setSelectedRangeFrom] = useState(null);
  const [selectedRangeTo, selSelectedRangeTo] = useState(null);
  // null 은 "달력 제한 없음". 응답 전·조회 실패·목록이 빈 경우 모두 null 로 둔다.
  // 빈 배열을 그대로 includeDates 에 주면 react-datepicker 가 "허용 날짜 0개" 로 읽어
  // 35칸이 전부 잠기고 월 이동 화살표까지 사라져 학생이 아무것도 할 수 없다.
  const [availableDate, setAvailableDate] = useState(null);
  const [earliestStartTime, setEarliestStartTime] = useState(null);
  const [startHour, setStartHour] = useState(null);
  const [startMinute, setStartMinute] = useState(null);
  const [endHour, setEndHour] = useState(null);
  const [endMinute, setEndMinute] = useState(null);
  const [maxReservationMinute, setMaxReservationMinute] = useState(null);
  const [openReserveModal, setOpenReserveModal] = useState(false);
  // 모달이 열리며 닫기 버튼에 자동 포커스가 가면 마우스 사용자에게도 focus-visible 링이
  // 보인다(flowbite Modal 이 FloatingFocusManager 로 initialFocus 대상에 포커스를 준다).
  // 대신 대화상자 컨테이너(role="dialog")를 initialFocus 로 지정한다 — WAI-ARIA APG 권장
  // 방식이고, 스크린리더는 aria-labelledby 로 제목을 읽으므로 안내가 끊기지 않는다.
  const reserveDialogRef = useRef(null);

  const navigate = useNavigate();
  const today = new Date();
  const departmentId = 1;

  const [selectedDate, setSelectedDate] = useUrlQuery(
    'date',
    format(new Date(), 'yyyy-MM-dd'),
  );

  const { mutateAsync: doReserve, isPending: isReserving } = useReserve();
  // isPending 은 다음 렌더에서야 true 가 되어 같은 tick 의 두 번째 클릭을 막지 못한다.
  // 실제 차단은 동기 래치가 한다.
  const reservingRef = useRef(false);
  const {
    data: reservationsByRooms,
    isPending: isReservationsPending,
    isError: isReservationsError,
    refetch: refetchReservations,
  } = useReservations({
    date: selectedDate,
    departmentId: departmentId,
  });
  const { loggedIn: isLoggedIn } = useAuth();

  // 분기 순서: 표가 손에 있으면 isError 여도 표를 그린다 — react-query v5 는 재조회가 실패해도
  // data 를 유지한다. 30초 폴링이나 앱 복귀 재조회가 한 번 실패했다고 표를 오류 카드로 바꾸면
  // 모바일은 유일한 예약 버튼(SelectionBar)까지 사라진다(MyInquiries 의 hasList 와 같은 규칙).
  const hasReservationData =
    !isReservationsPending && Array.isArray(reservationsByRooms);
  const hasRooms = hasReservationData && reservationsByRooms.length > 0;

  // 화면을 열어둔 채 시간이 지나면 지난 칸이 저절로 잠기도록 현재 시각을 갱신한다
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // 선택해 둔 첫 칸이 시간이 지나 잠기면 선택을 푼다. 잠긴 칸을 예약하려다 실패하는 일을 막는다
  useEffect(() => {
    if (!selectedRangeFrom) return;
    if (now > addMinutes(selectedRangeFrom, 30)) {
      setSelectedRoom(null);
      setSelectedRangeFrom(null);
      selSelectedRangeTo(null);
    }
  }, [now, selectedRangeFrom]);

  useEffect(() => {
    if (reservationsByRooms && reservationsByRooms.length > 0) {
      const startTimes = reservationsByRooms?.map(
        room => room.operationStartTime,
      );
      // operationStartTime들에서 서로 비교해서 제일 작은 값이 earliest가 되게
      const earliestTime = startTimes.reduce((earliest, current) => {
        return earliest < current ? earliest : current;
      });
      setEarliestStartTime(earliestTime);

      // ':' 분리해서 시와 분으로 나눠서 저장
      const [startHour, startMinute] = earliestTime.split(':');
      setStartHour(parseInt(startHour, 10));
      setStartMinute(parseInt(startMinute, 10));

      const endTimes = reservationsByRooms?.map(room => room.operationEndTime);

      // operationEndTime들에서 서로 비교해서 제일 큰 값이 latest가 되게
      const latestTime = endTimes.reduce((latest, current) => {
        return latest > current ? latest : current;
      });
      // ':' 분리해서 시와 분으로 나눠서 저장
      const [endHour, endMinute] = latestTime.split(':');
      setEndHour(parseInt(endHour, 10));
      setEndMinute(parseInt(endMinute, 10));

      // eachMaxMinute들을 배열로 저장
      const eachMaxMinutes = reservationsByRooms?.map(
        partition => partition.eachMaxMinute,
      );
      // 배열들 중에 가장 큰 값을 maxEachMaxMinute으로 저장
      const maxEachMaxMinute = Math.max(...eachMaxMinutes);
      setMaxReservationMinute(maxEachMaxMinute);
    }
  }, [reservationsByRooms]);

  // 날짜 변경 시 기존 선택 초기화.
  // 예약 현황은 30초마다 다시 불러오므로 조회 결과가 아니라 날짜에만 반응해야
  // 남이 예약하는 순간 학생이 고르던 칸이 풀리지 않는다.
  useEffect(() => {
    setSelectedRoom(null);
    setSelectedRangeFrom(null);
    selSelectedRangeTo(null);
  }, [selectedDate]);

  // 계산해놓은 시간들을 timeTableConfig에 객체로 선언
  const timeTableConfig = {
    startTime: {
      hour: startHour,
      minute: startMinute,
    },
    endTime: {
      hour: endHour,
      minute: endMinute,
    },
    intervalMinute: SLOT_INTERVAL_MINUTE,
    maxReservationMinute: maxReservationMinute,
  };

  const times = useMemo(
    () =>
      startHour !== null && startMinute !== null
        ? createTimeTable(timeTableConfig)
        : [],
    [startHour, startMinute, endHour, endMinute, maxReservationMinute],
  );

  // date-picker에서 날짜 선택할 때마다 실행되는 함수
  const handleDateChange = date => {
    // 입력칸을 비우면 onChange(null) 이 온다. format(null) 은 RangeError 를 던진다.
    if (!date) return;
    const formattedDate = format(date, 'yyyy-MM-dd');
    // date picker에서 선택한 날짜 저장
    setSelectedDate(formattedDate);
  };

  // 슬롯의 상태 토글하는 함수
  const toggleSlot = useCallback(
    (partition, time) => {
      const targetStartAt = parse(
        `${selectedDate} ${time}`,
        'yyyy-MM-dd HH:mm',
        new Date(),
      );
      const targetEndAt = addMinutes(
        targetStartAt,
        timeTableConfig.intervalMinute,
      );

      const isFirstSelect = !selectedRangeFrom && !selectedRangeTo;
      // 예약 현황은 30초마다 다시 불러온다. 남이 예약하면 그 방 객체만 새 참조로 바뀌므로
      // 객체를 그대로 비교하면 고르던 칸이 연장되지 않고 새 선택으로 접힌다. 식별자로 비교한다.
      const isSameRoom =
        !!selectedRoom && selectedRoom.partitionId === partition.partitionId;
      const isDifferentRoom = !isSameRoom;

      const isSelectPast = isBefore(targetStartAt, selectedRangeFrom);
      const isOverDue =
        differenceInMinutes(targetEndAt, selectedRangeFrom) >
        selectedRoom?.eachMaxMinute;

      if (
        isSameRoom &&
        selectedRangeFrom?.getTime() === targetStartAt.getTime() &&
        selectedRangeTo?.getTime() === targetEndAt.getTime()
      ) {
        setSelectedRoom(null);
        setSelectedRangeFrom(null);
        selSelectedRangeTo(null);
        return;
      }

      // 새롭게 시간을 선택함
      if (isFirstSelect || isDifferentRoom || isSelectPast) {
        setSelectedRoom(partition);
        setSelectedRangeFrom(targetStartAt);
        selSelectedRangeTo(targetEndAt);
        return;
      }

      // 연장 범위 안에 남의 예약이 있으면 건너뛰지 않고 클릭한 칸부터 새로 선택한다.
      // 남의 예약을 가로지르는 범위는 연장이 될 수 없으니 최대 시간 검사보다 먼저 본다.
      if (
        hasReservedSlotInRange(
          partition.reservationTimeRanges,
          selectedRangeFrom,
          targetEndAt,
        )
      ) {
        setSelectedRoom(partition);
        setSelectedRangeFrom(targetStartAt);
        selSelectedRangeTo(targetEndAt);
        return;
      }

      // 최대 예약 시간을 넘는 연장은 안내만 하고 선택은 그대로 둔다
      if (isOverDue) {
        showSnackbar(maxMinutesExceededMessage(selectedRoom?.eachMaxMinute));
        return;
      }

      // 시간을 연장함
      setSelectedRoom(partition);
      selSelectedRangeTo(targetEndAt);
    },
    [
      selectedDate,
      setSelectedRangeFrom,
      selSelectedRangeTo,
      selectedRoom,
      selectedRangeFrom,
      selectedRangeTo,
      showSnackbar,
    ],
  );

  // 자신의 예약 생성
  const handleReservation = useCallback(
    async ({ roomPartitionId, startDateTime, endDateTime }) => {
      if (reservingRef.current) return;
      if (!isLoggedIn) {
        openSnackbar('로그인 후에 세미나실 예약이 가능합니다.');
        setTimeout(() => {
          closeSnackbar();
          navigate('/login');
        }, 5000);
        return;
      }
      if (!selectedRoom || !selectedRangeFrom || !selectedRangeTo) {
        openSnackbar(
          '원하는 호실과 시간대를 선택하고 예약하기 버튼을 눌러주세요',
        );
        setTimeout(() => {
          closeSnackbar();
        }, 5000);
        return;
      }
      // 요청이 끝나기 전에 다시 누르면 같은 예약이 두 번 전송된다
      if (reservingRef.current) return;
      reservingRef.current = true;
      try {
        await doReserve({
          roomPartitionId,
          startDateTime,
          endDateTime,
        });
        navigate('/check');
      } catch (error) {
        // 인터셉터가 세션 만료로 확정한 경우만 SessionExpiryWatcher 가 안내한다.
        // 그 밖의 인증 오류(403 권한 없음 등)는 인터셉터가 손대지 않으므로 여기서 안내한다.
        if (error?.sessionExpired) return;
        if (isAuthError(error)) {
          openSnackbar(RESERVE_AUTH_FAILED_MESSAGE);
          return;
        }

        const status = error?.response?.status;
        const code = normalizeErrorCode(error?.response?.data?.code);

        // 노쇼 차단이면 해제일을 조회해 문구에 넣는다. 조회에 실패해도 안내는 한다
        let blockedUntil = null;
        if (code === 'RESERVATION-004') {
          try {
            const blocked = await fetchBlockedPeriod();
            blockedUntil = blocked?.data?.endBlockedDate ?? null;
          } catch {
            blockedUntil = null;
          }
        }

        openSnackbar(getReserveErrorMessage(code, { blockedUntil }));

        // 업무 규칙에 걸린 선택은 그대로 두면 같은 실패가 반복된다
        if (status === 412) {
          setSelectedRoom(null);
          setSelectedRangeFrom(null);
          selSelectedRangeTo(null);
        }
      } finally {
        reservingRef.current = false;
      }
    },
    [doReserve, isLoggedIn, selectedRoom, selectedRangeFrom, selectedRangeTo],
  );

  const openReserveConfirm = () => {
    if (isReserving) return;
    if (selectedRoom && selectedRangeFrom && selectedRangeTo) {
      setOpenReserveModal(true);
    } else {
      showSnackbar('원하는 호실과 시간대를 선택해주세요.');
    }
  };

  // 최대 예약 시간에 부합하는지 계산하는 함수
  const handleCellClick = useCallback(
    (partition, timeIndex) => {
      const slotDateFrom = parse(
        `${selectedDate} ${times[timeIndex]}`,
        'yyyy-MM-dd HH:mm',
        new Date(),
      );

      // 갱신 주기 사이에 지나가 버린 칸이 눌리지 않게 클릭 시점으로 한 번 더 확인한다
      const clickedAt = new Date();
      if (clickedAt > addMinutes(slotDateFrom, SLOT_INTERVAL_MINUTE)) {
        setNow(clickedAt);
        return;
      }

      // 표의 공통 범위가 아니라 방별 운영시간으로 검사한다
      const isClosed = isOutsideOperationHours(
        format(slotDateFrom, 'HH:mm'),
        partition.operationStartTime,
        partition.operationEndTime,
      );

      if (!isClosed) {
        toggleSlot(partition, times[timeIndex]);
      }
    },
    [selectedDate, times, toggleSlot],
  );

  const handleSlotClick = useCallback(
    (room, timeIndex, state) => {
      if (!state.selectable) return;
      handleCellClick(room, timeIndex);
    },
    [handleCellClick],
  );

  // 매 렌더 새 객체를 만들면 표에 넘기는 selection prop 이 계속 바뀌어 표의 memo 가 무력해진다.
  const selection = useMemo(
    () =>
      selectedRoom && selectedRangeFrom && selectedRangeTo
        ? {
            partitionId: selectedRoom.partitionId,
            from: selectedRangeFrom,
            to: selectedRangeTo,
          }
        : null,
    [selectedRoom, selectedRangeFrom, selectedRangeTo],
  );

  // 예약 확인 모달의 타임레일에 쓰는 값. 순수 함수 결과라 useMemo 는 필요 없다.
  const modalDateLabel = shortDateLabel(selectedDate);
  const modalFromLabel = selectedRangeFrom
    ? format(selectedRangeFrom, 'HH:mm')
    : '';
  const modalToLabel = selectedRangeTo ? format(selectedRangeTo, 'HH:mm') : '';
  const modalDurationText =
    selectedRangeFrom && selectedRangeTo
      ? durationLabel(differenceInMinutes(selectedRangeTo, selectedRangeFrom))
      : '';
  // 타임레일은 시각 표현이라 시작/종료 라벨과 점선이 스크린리더에 조각으로 읽힌다.
  // 블록 전체를 한 문장으로 읽도록 aria-label 을 만든다.
  const modalTimeAriaLabel =
    modalFromLabel && modalToLabel
      ? `${modalDateLabel} ${modalFromLabel}부터 ${modalToLabel}까지${
          modalDurationText ? `, ${modalDurationText}` : ''
        }`
      : '';

  // date-picker 설정
  registerLocale('ko', ko);

  // 현재로부터 예약 가능한 방들의 날짜 목록 가져오기
  useEffect(() => {
    const getDate = async () => {
      try {
        const dates = await fetchDate(departmentId);
        const hasDates = Array.isArray(dates) && dates.length > 0;
        setAvailableDate(hasDates ? dates : null);
      } catch {
        // 목록이 비어 있으면 달력의 모든 날짜가 잠기므로 제한을 풀고 안내한다
        setAvailableDate(null);
        openSnackbar(
          '예약 가능한 날짜를 불러오지 못했습니다. 달력에서 날짜를 직접 골라 주세요.',
        );
      }
    };
    getDate();
  }, []);

  return (
    <>
      <div id="container">
        <div id="head-container">
          <Typography
            marginTop="50px"
            variant="h5"
            fontWeight={450}
            component="div"
            align="center">
            일자별 세미나실 예약 현황
          </Typography>
          <div
            id="text"
            className="mt-5 mx-3 justify-center text-center break-keep"
            style={{ color: '#9D9FA2' }}>
            아래 예약 현황의 예약가능 시간을 선택하면 해당 세미나실을 예약하여
            사용할 수 있습니다.
          </div>
          {/* 배너 */}
          <Banner />
          {/* date-picker 부분 */}
          <div className="flex justify-center">
            <div id="datepicker-container">
              <DatePicker
                id="date"
                className={'text-center flex'}
                selected={selectedDate}
                locale={ko}
                minDate={today}
                includeDates={availableDate}
                // 허용 날짜가 이번 달에 없어도 화살표는 남긴다(비활성 표시). 화살표까지 사라지면
                // 고장 난 화면으로 보인다.
                showDisabledMonthNavigation
                onChange={handleDateChange}
                dateFormat="yyyy년 MM월 dd일"
                showIcon
              />
            </div>
          </div>
        </div>
        {hasRooms && isReservationsError && (
          <div
            role="status"
            aria-live="polite"
            className="mx-8 md:mx-12 lg:mx-96 mb-2 flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <span>
              최신 예약 현황을 못 받아왔습니다. 표시된 내용이 실제와 다를 수
              있습니다.
            </span>
            <button
              type="button"
              onClick={() => refetchReservations()}
              className="inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-bold text-[#002D56] hover:underline">
              다시 시도
            </button>
          </div>
        )}
        {hasRooms && <TimeTableLegend />}
        {/* timeTable 시작 */}
        {isReservationsPending && (
          <div className="text-center mx-8 md:mx-12 lg:mx-96 py-12 my-12 rounded-lg bg-gray-100 text-gray-900">
            예약 현황을 불러오는 중입니다.
          </div>
        )}
        {!isReservationsPending && !hasRooms && isReservationsError && (
          <div className="text-center mx-8 md:mx-12 lg:mx-96 py-12 my-12 rounded-lg bg-gray-100 text-gray-900">
            예약 현황을 불러오지 못했습니다.
            <div className="mt-4 flex justify-center">
              <Button
                size="sm"
                color="dark"
                onClick={() => refetchReservations()}>
                다시 시도
              </Button>
            </div>
          </div>
        )}
        {hasRooms && times.length > 0 && (
          <div>
            <ReservationTimeTable
              rooms={reservationsByRooms}
              times={times}
              selectedDate={selectedDate}
              now={now}
              selection={selection}
              onCellClick={handleSlotClick}
            />
          </div>
        )}
        {hasReservationData && !hasRooms && !isReservationsError && (
          <div className="mx-3 my-8 min-[900px]:mx-6">
            <div className="mx-auto max-w-2xl">
              <BooEmptyState
                illustration="rest"
                title="선택한 날짜에는 세미나실을 운영하지 않아요"
                description="달력에서 다른 날짜를 확인해 주세요."
              />
            </div>
          </div>
        )}
        {hasRooms && (
          <div className="hidden p-10 md:flex md:justify-end">
            <CustomButton
              disabled={isReserving}
              onClick={openReserveConfirm}
              text="예약하기"
            />
          </div>
        )}
        {hasRooms && (
          <SelectionBar
            roomLabel={
              selectedRoom
                ? `${selectedRoom.roomName}-${selectedRoom.partitionNumber}`
                : null
            }
            from={selectedRangeFrom}
            to={selectedRangeTo}
            disabled={isReserving}
            onReserve={openReserveConfirm}
          />
        )}
      </div>

      {/* 선택된 예약 정보 모달 — "타임레일" 디자인. 크림 블록·시간 레일은 시각 표현이라
          시작/종료 라벨과 점선 조각이 아니라 이 블록 전체를 한 문장 aria-label 로 읽는다
          (modalTimeAriaLabel, 위에서 계산). */}
      <Modal
        ref={reserveDialogRef}
        initialFocus={reserveDialogRef}
        className="flex items-center justify-center"
        theme={modalTheme}
        dismissible
        show={openReserveModal}
        onClose={() => setOpenReserveModal(false)}>
        <Modal.Header>이대로 예약할까요?</Modal.Header>
        <Modal.Body>
          <div className="flex flex-col gap-[13px] rounded-[18px] bg-[#F1EEE9] px-4 pb-[17px] pt-[15px] shadow-[inset_0_0_0_1px_rgba(0,45,86,0.06)]">
            <div className="flex min-w-0 items-center justify-between gap-[10px]">
              <span className="whitespace-nowrap text-[13.5px] font-semibold leading-[1.2] tracking-[-0.012em] text-[#566072]">
                {modalDateLabel}
              </span>
              <span className="flex-none whitespace-nowrap rounded-full border border-[rgba(0,45,86,0.14)] bg-white px-[11px] py-[6px] text-[14px] font-bold leading-none tracking-[-0.012em] text-[#002D56] shadow-[0_1px_1px_rgba(0,45,86,0.05)]">
                {selectedRoom?.roomName}-{selectedRoom?.partitionNumber}
              </span>
            </div>

            <div
              role="group"
              aria-label={modalTimeAriaLabel}
              className="flex items-end gap-2 pt-px">
              <div
                aria-hidden="true"
                className="flex min-w-0 flex-none flex-col gap-[3px]">
                <span className="h-[14px] text-[11px] font-bold leading-[14px] tracking-[0.09em] text-[#566072]">
                  시작
                </span>
                <span className="h-7 text-[25px] font-extrabold leading-7 tracking-[-0.03em] tabular-nums text-[#002D56] max-[359px]:text-[22px]">
                  {modalFromLabel}
                </span>
              </div>

              <div
                aria-hidden="true"
                className="relative flex h-7 min-w-[62px] flex-1 items-center justify-center self-end">
                <span
                  className="absolute left-0 right-0 top-1/2 -mt-px h-[2px] rounded-[2px]"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, rgba(0,45,86,.34) 0 5px, rgba(0,45,86,0) 5px 9px)',
                  }}
                />
                {modalDurationText && (
                  <span className="relative z-[1] mx-[10px] whitespace-nowrap rounded-full border border-[rgba(0,45,86,0.14)] bg-white px-[10px] py-[6px] text-[12px] font-extrabold leading-none tracking-[-0.01em] text-[#002D56] shadow-[0_1px_2px_rgba(0,45,86,0.07)] max-[359px]:mx-[6px] max-[359px]:px-[8px] max-[359px]:py-[5px]">
                    {modalDurationText}
                  </span>
                )}
              </div>

              <div
                aria-hidden="true"
                className="flex min-w-0 flex-none flex-col items-end gap-[3px] text-right">
                <span className="h-[14px] text-[11px] font-bold leading-[14px] tracking-[0.09em] text-[#566072]">
                  종료
                </span>
                <span className="h-7 text-[25px] font-extrabold leading-7 tracking-[-0.03em] tabular-nums text-[#002D56] max-[359px]:text-[22px]">
                  {modalToLabel}
                </span>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex w-full gap-2.5">
            <Button
              color="light"
              theme={reserveActionButtonTheme}
              className="h-[50px] min-h-[50px] w-[104px] flex-none rounded-[16px] p-0 tracking-[-0.012em] transition duration-150 enabled:active:translate-y-px enabled:active:scale-[0.995] max-[359px]:w-[88px]"
              onClick={() => {
                setOpenReserveModal(false);
              }}>
              취소
            </Button>
            <Button
              disabled={isReserving}
              theme={reserveActionButtonTheme}
              onClick={() => {
                if (isReserving) return;
                handleReservation({
                  roomPartitionId: selectedRoom
                    ? selectedRoom.partitionId
                    : null,
                  startDateTime: selectedRangeFrom,
                  endDateTime: selectedRangeTo,
                });
                setOpenReserveModal(false);
              }}
              color="dark"
              className="h-[50px] min-h-[50px] flex-1 rounded-[16px] p-0 tracking-[-0.012em] transition duration-150 enabled:active:translate-y-px enabled:active:scale-[0.995]">
              예약
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default RoomPage;
