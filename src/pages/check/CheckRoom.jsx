import React, { useRef, useState } from 'react';
import {
  Button as MuiButton,
  Popover,
  Typography,
  Pagination,
  Tooltip,
} from '@mui/material';
import { format } from 'date-fns';
import { Button, Modal, Table } from 'flowbite-react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { Link } from 'react-router-dom';
import { useMyInquiries } from '../../api/inquiry.api';
import {
  useNoShow,
  useLatestReservation,
  useDeleteReservation,
  useUserReservation,
} from '../../api/reservation.api';
import { useMyInfo, useBlockedPeriod } from '../../api/user.api';
import { useCustomSnackbars } from '../../components/snackbar/SnackBar';
import {
  formatReservationTime,
  formatRoom,
  isDisputable,
  reservationStateLabel,
  sortReservationsLatestFirst,
} from '../inquiry/reservationView';
import { cancelReservationErrorMessage } from './cancelReservationMessage';

const Check = () => {
  const {
    data: noShow,
    isPending: isNoShowPending,
    isError: isNoShowError,
    refetch: refetchNoShow,
  } = useNoShow();
  const {
    data: reservations,
    isPending: isReservationsPending,
    isError: isReservationsError,
    refetch: refetchReservations,
  } = useUserReservation();
  const { data: me } = useMyInfo();
  // 이미 문의한 예약은 "문의 보기" 로 — 표와 팝오버에서 같은 건을 두 번 접수하지 않게.
  // 목록 조회가 실패·로딩이면 그냥 "문의" 로 둔다(중복 접수는 서버가 막지 않지만 드물다).
  const { data: inquiries } = useMyInquiries();
  const { data: latest } = useLatestReservation();
  const { mutateAsync: deleteReservation, isPending: isDeleting } =
    useDeleteReservation();
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();
  // isPending 은 다음 렌더에서야 true 가 되어 같은 tick 의 두 번째 클릭을 막지 못한다.
  // 실제 차단은 동기 래치가 한다.
  const deletingRef = useRef(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [anchorEl, setAnchorEl] = useState(null);
  const [openModal, setOpenModal] = useState(null);
  const handleMuiBtnClick = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  // 제한 기간은 팝오버를 여는 시점에 조회해 첫 열람부터 보이게 한다.
  // 이미 제한 상태인 학생은 화면에 들어올 때 미리 받아 둔다.
  // 제한 상태가 아니면 null 이 온다(조회 실패가 아니다).
  const {
    data: blockedPeriod,
    isPending: isBlockedPeriodPending,
    isError: isBlockedPeriodError,
  } = useBlockedPeriod({ enabled: open || me?.serviceRole === 'BLOCKED' });
  const blockedDates = blockedPeriod?.data;
  const hasBlockedPeriod = Boolean(
    blockedDates?.startBlockedDate && blockedDates?.endBlockedDate,
  );

  const handleDelete = async id => {
    // 응답이 오기 전에 확인을 다시 누르면 같은 예약을 두 번 취소하게 된다.
    if (deletingRef.current) return;
    deletingRef.current = true;
    try {
      // 서버 성공 문구는 "리소스가 성공적으로 삭제되었습니다" 라 학생이 볼 말이 아니다.
      // 실패 이유도 서버 원문 대신 에러 코드로 학생용 문구를 고른다.
      await deleteReservation(id);
      openSuccessSnackbar('예약을 취소했습니다.', 3000);
    } catch (error) {
      const message = cancelReservationErrorMessage(error);
      if (message) openErrorSnackbar(message, 3000);
    } finally {
      deletingRef.current = false;
    }
    setOpenModal(null); // 모달 닫기
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  // 예약 → 그 예약의 문의 번호. 상세로 곧장 보내려면 id 가 필요하다. 한 예약에 문의가 여럿이면
  // 목록 순서(접수일 내림차순)의 첫 건, 즉 가장 최근 건을 남긴다.
  const inquiryIdByReservationId = new Map();
  (Array.isArray(inquiries) ? inquiries : []).forEach(inquiry => {
    if (inquiry.reservationId == null) return;
    if (inquiryIdByReservationId.has(inquiry.reservationId)) return;
    inquiryIdByReservationId.set(inquiry.reservationId, inquiry.inquiryId);
  });

  // 서버는 생성 역순으로 준다 — 내일 예약을 먼저 잡고 오늘 예약을 나중에 잡으면 표에서 뒤집힌다.
  const sortedReservations = sortReservationsLatestFirst(reservations);

  // count를 계산하고 NaN이 아닐 때만 사용할 수 있도록 안전한 변수를 생성합니다.
  const pageCount = reservations
    ? Math.ceil(sortedReservations.length / itemsPerPage)
    : 0;

  // 마지막 페이지의 유일한 예약을 취소하면 현재 페이지가 범위를 벗어나 빈 표만 남는다.
  const safePage = pageCount > 0 ? Math.min(currentPage, pageCount) : 1;

  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedReservations = sortedReservations.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // 조회 실패를 빈 목록으로 오인하지 않도록 로딩·실패·없음을 따로 보여준다.
  const isReservationsLoaded = !isReservationsPending && !isReservationsError;
  const hasReservations = isReservationsLoaded && reservations?.length > 0;

  // 문제를 보고 있는 화면에서 바로 이의를 시작하게 한다 — 폼이 예약을 확정한 채로 열린다.
  const actionLinkClass =
    'inline-flex min-h-[44px] items-center px-2 font-medium text-[#002D56] hover:underline';
  const renderInquiryLink = reservation => {
    const inquiryId = inquiryIdByReservationId.get(reservation.reservationId);
    return inquiryId != null ? (
      <Link
        to={`/inquiry/${inquiryId}`}
        aria-label={`${formatReservationTime(reservation)} ${formatRoom(reservation)} 문의 보기`}
        className={actionLinkClass}>
        문의 보기
      </Link>
    ) : (
      <Link
        to={`/inquiry/new?category=ATTENDANCE&reservationId=${reservation.reservationId}`}
        aria-label={`${formatReservationTime(reservation)} ${formatRoom(reservation)} 출석 문의하기`}
        className={actionLinkClass}>
        문의
      </Link>
    );
  };

  return (
    <div>
      <div className="flex justify-center text-2xl mt-20">
        {me?.name}님의 신청 현황
      </div>
      <div id="table" className="overflow-x-auto mt-10">
        <Table className="border">
          <Table.Head
            style={{ fontSize: 15 }}
            className="text-black text-center">
            <Table.HeadCell className="px-2 py-4">출석 여부</Table.HeadCell>
            <Table.HeadCell className="px-2 py-4">호실</Table.HeadCell>
            <Table.HeadCell className="px-2 py-4">날짜</Table.HeadCell>
            <Table.HeadCell className="px-2 py-4">시작 시간</Table.HeadCell>
            <Table.HeadCell className="px-2 py-4">종료 시간</Table.HeadCell>
            <Table.HeadCell className="px-2 py-4">
              <span className="sr-only">관리</span>
            </Table.HeadCell>
          </Table.Head>
          <Table.Body className="divide-y">
            {isReservationsPending && (
              <Table.Row className="bg-white text-center text-gray-900">
                <Table.Cell colSpan={6} className="px-2 py-8">
                  예약 목록을 불러오는 중입니다.
                </Table.Cell>
              </Table.Row>
            )}
            {!isReservationsPending && isReservationsError && (
              <Table.Row className="bg-white text-center text-gray-900">
                <Table.Cell colSpan={6} className="px-2 py-8">
                  예약 목록을 불러오지 못했습니다.
                  <div className="mt-4 flex justify-center">
                    <Button
                      size="sm"
                      color="dark"
                      onClick={() => refetchReservations()}>
                      다시 시도
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            )}
            {isReservationsLoaded && !hasReservations && (
              <Table.Row className="bg-white text-center text-gray-900">
                <Table.Cell colSpan={6} className="px-2 py-8">
                  예약 내역이 없습니다.
                </Table.Cell>
              </Table.Row>
            )}
            {hasReservations &&
              paginatedReservations.map((reservation, index) => {
                const start = new Date(reservation.reservationStartTime);
                const end = new Date(reservation.reservationEndTime);
                const isPast = start < new Date();
                return (
                  <Table.Row
                    key={index}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800 text-center text-gray-900">
                    <Table.Cell>
                      {reservationStateLabel(reservation) === '처리됨' ? (
                        <Tooltip
                          title={
                            <Typography sx={{ fontSize: '1.2em' }}>
                              노쇼가 4회가 되어 예약이 제한된 뒤, 제한 기간이
                              끝나 노쇼 횟수에서 빠진 예약입니다.
                            </Typography>
                          }>
                          <span>처리됨</span>
                        </Tooltip>
                      ) : (
                        reservationStateLabel(reservation)
                      )}
                    </Table.Cell>
                    <Table.Cell className="px-2 py-4">
                      {formatRoom(reservation)}
                    </Table.Cell>
                    <Table.Cell className="px-2 py-4">
                      {format(start, 'MM-dd')}
                    </Table.Cell>
                    <Table.Cell className="px-2 py-4">
                      {format(start, 'HH:mm')}
                    </Table.Cell>
                    <Table.Cell className="px-2 py-4">
                      {format(end, 'HH:mm')}
                    </Table.Cell>
                    <Table.Cell className="px-2 py-4">
                      {/* 지난 미출석·처리됨은 문의로, 앞으로의 예약은 삭제로. 삭제 조건은 현행 그대로 —
                          시작 15분 전 체크인으로 VISITED 인데 아직 시작 전인 행이 있다. */}
                      {isDisputable(reservation)
                        ? renderInquiryLink(reservation)
                        : !(
                            isPast || reservation.reservationState === 'VISITED'
                          ) && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenModal(reservation.reservationId);
                              }}
                              // 앱에서 예약을 취소하는 유일한 경로. 글자 높이(20px)만 눌리던 것을
                              // 같은 자리의 문의 링크와 같은 44px 로 맞춘다. 접근 이름에 시각·호실을
                              // 넣어 여러 행이 전부 "삭제" 로 읽히지 않게 한다.
                              aria-label={`${formatReservationTime(reservation)} ${formatRoom(reservation)} 예약 취소`}
                              className="inline-flex min-h-[44px] items-center px-2 font-medium text-red-600 hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]">
                              삭제
                            </button>
                          )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
          </Table.Body>
        </Table>
      </div>

      <Pagination
        count={pageCount} // 안전한 pageCount 값을 전달합니다.
        page={safePage}
        onChange={handlePageChange}
        shape="rounded"
        className="flex justify-center mt-4"
      />

      <div id="popover" className="mt-6">
        <MuiButton
          style={{
            backgroundColor: '#002D56',
            marginLeft: 15,
            marginTop: 20,
            marginBottom: 40,
          }}
          aria-describedby={id}
          variant="contained"
          onClick={handleMuiBtnClick}>
          내 노쇼 현황
        </MuiButton>
        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}>
          {isNoShowPending && (
            <Typography sx={{ px: 2, py: 1 }}>
              노쇼 현황을 불러오는 중입니다.
            </Typography>
          )}
          {!isNoShowPending && isNoShowError && (
            <div className="px-4 py-2 text-center">
              <Typography>노쇼 현황을 불러오지 못했습니다.</Typography>
              <div className="mt-2 flex justify-center">
                <Button size="sm" color="dark" onClick={() => refetchNoShow()}>
                  다시 시도
                </Button>
              </div>
            </div>
          )}
          {!isNoShowPending && !isNoShowError && noShow && (
            <>
              <Typography sx={{ px: 2, py: 1 }}>
                {`* 현재 예약 취소 없이 세미나실을 방문하지 않은 횟수는 ${noShow.noShowCount}번 입니다.`}
              </Typography>
              <Typography sx={{ px: 3 }} className="text-red-700">
                (노쇼가 4회가 되면 세미나실 예약이 1개월 동안 제한됩니다)
              </Typography>
            </>
          )}
          {isBlockedPeriodPending && (
            <Typography sx={{ px: 3, py: 1 }}>
              예약 제한 기간을 확인하는 중입니다.
            </Typography>
          )}
          {!isBlockedPeriodPending && isBlockedPeriodError && (
            <Typography sx={{ px: 3, py: 1 }}>
              예약 제한 기간을 불러오지 못했습니다.
            </Typography>
          )}
          {hasBlockedPeriod && (
            <Typography sx={{ px: 3, py: 1 }}>
              {`현재 예약 제한 기간 : ${blockedDates.startBlockedDate} ~ ${blockedDates.endBlockedDate}`}
            </Typography>
          )}

          {!isNoShowPending && !isNoShowError && noShow && (
            <div className="overflow-x-auto">
              <Table>
                <Table.Head className="text-black text-center">
                  <Table.HeadCell>출석 상태</Table.HeadCell>
                  <Table.HeadCell>날짜</Table.HeadCell>
                  <Table.HeadCell>호실</Table.HeadCell>
                  <Table.HeadCell>시작 시간</Table.HeadCell>
                  <Table.HeadCell>종료 시간</Table.HeadCell>
                  <Table.HeadCell>
                    <span className="sr-only">관리</span>
                  </Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y text-center">
                  {noShow.reservationList?.reservationInfoResponses?.map(
                    (reservation, index) => (
                      <Table.Row
                        key={index}
                        className="bg-white dark:border-gray-700 dark:bg-gray-800">
                        <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                          {reservationStateLabel(reservation)}
                        </Table.Cell>
                        <Table.Cell>
                          {format(
                            new Date(reservation.reservationStartTime),
                            'yyyy-MM-dd',
                          )}
                        </Table.Cell>
                        <Table.Cell>{formatRoom(reservation)}</Table.Cell>
                        <Table.Cell>
                          {format(reservation.reservationStartTime, 'HH:mm')}
                        </Table.Cell>
                        <Table.Cell>
                          {format(reservation.reservationEndTime, 'HH:mm')}
                        </Table.Cell>
                        <Table.Cell>
                          {isDisputable(reservation)
                            ? renderInquiryLink(reservation)
                            : null}
                        </Table.Cell>
                      </Table.Row>
                    ),
                  )}
                </Table.Body>
              </Table>
            </div>
          )}
        </Popover>
      </div>

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
                해당 예약을 삭제하시겠습니까?
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

export default Check;
