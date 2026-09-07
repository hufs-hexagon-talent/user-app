import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { format, addDays } from 'date-fns';
import { Pagination } from '@mui/material';
import { useCustomSnackbars } from '../../../components/snackbar/SnackBar';
import { useAllRooms } from '../../../api/room.api';
import {
  useChangeState,
  useAdminDeleteReservation,
  useExportReservationExcel,
  useReservationSearch,
  useStates,
} from '../../../api/reservation.api';
import { Table, Checkbox, Modal, Button } from 'flowbite-react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import 'react-datepicker/dist/react-datepicker.css';
import { FaFileExcel } from 'react-icons/fa6';

const ReservationState = () => {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [openEditModal, setOpenEditModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openExportModal, setOpenExportModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();

  const { data: rooms } = useAllRooms();
  const { data: serviceRoles } = useStates();

  const { mutate: doDelete } = useAdminDeleteReservation();
  const { mutateAsync: changeState } = useChangeState();
  const { mutateAsync: reservationSearch } = useReservationSearch();

  // 선택된 serviceRoles 관리
  const toggleRole = role => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role],
    );
  };

  // UTC 변환 함수
  const toISODateUTC = date => {
    return format(date, "yyyy-MM-dd'T'00:00:00'Z'");
  };

  // 예약 목록 refetch 함수
  const refetchReservations = async () => {
    const startDateTime = toISODateUTC(selectedDate);
    const endDateTime = toISODateUTC(addDays(selectedDate, 1));

    const res = await reservationSearch({
      startDateTime,
      endDateTime,
      roomIds: selectedRoomIds.length > 0 ? selectedRoomIds : undefined,
      page: currentPage - 1,
    });

    setReservations(res.data.items);
    setTotalPages(res.data.meta.totalPages);
    setPageSize(res.data.meta.size);
  };

  // 출석 상태 변경 함수
  const handleStateChange = async state => {
    try {
      const response = await changeState({
        reservationId: selectedReservationId,
        state,
      });
      openSuccessSnackbar(response.message, 2500);
      setOpenEditModal(false);
      await refetchReservations(); // 변경 후 refetch
    } catch (error) {
      openErrorSnackbar(error.response.data.errorMessage, 2500);
    }
  };

  // 예약 삭제
  const handleDelete = reservationId => {
    doDelete(reservationId, {
      onSuccess: async () => {
        setReservations(prevReservations =>
          prevReservations.filter(
            reservation => reservation.reservationId !== reservationId,
          ),
        );
      },
      onError: async () => {
        openErrorSnackbar('예약 삭제 실패', 3000);
      },
    });
  };

  // 호실 선택
  const handleRoomSelect = roomId => {
    setSelectedRoomIds(prev =>
      prev.includes(roomId)
        ? prev.filter(r => r !== roomId)
        : [...prev, roomId],
    );
    setCurrentPage(1);
  };

  // 호실 선택이 바뀌면 페이지 초기화
  useEffect(() => {
    const fetchReservations = async () => {
      const startDateTime = toISODateUTC(selectedDate);
      const endDateTime = toISODateUTC(addDays(selectedDate, 1));

      try {
        const res = await reservationSearch({
          startDateTime,
          endDateTime,
          roomIds: selectedRoomIds.length > 0 ? selectedRoomIds : undefined,
          page: currentPage - 1,
        });

        setReservations(res.data.items);
        setTotalPages(res.data.meta.totalPages);
        setPageSize(res.data.meta.size);
      } catch (error) {
        openErrorSnackbar(error?.response?.data?.message || '조회 실패');
      }
    };

    fetchReservations();
  }, [selectedDate, currentPage, selectedRoomIds]);

  return (
    <div>
      <div className="font-bold text-3xl text-black px-4 py-8">
        Reservation State Management
      </div>
      {/* 날짜 선택 */}
      <div className="py-4">
        <DatePicker
          selected={selectedDate}
          onChange={date => setSelectedDate(date)}
          dateFormat="yyyy-MM-dd"
          locale="ko"
          className="border border-gray-300 p-2 rounded"
        />
      </div>
      <div className="flex flex-row items-center justify-between">
        {/* 호실 필터링 체크박스 */}
        <div className="flex flex-row gap-x-6 items-center pt-4 pb-8">
          {rooms?.map(room => (
            <div
              key={room.roomId}
              className="flex flex-row gap-x-2 items-center">
              <Checkbox
                checked={selectedRoomIds.includes(room.roomId)}
                onChange={() => handleRoomSelect(room.roomId)}
                className="rounded-none text-[#1D2430] focus:ring-[#1D2430]"
              />
              <div>{room.roomName}호</div>
            </div>
          ))}
        </div>
        <div className="flex space-x-4 items-center">
          {selectedReservationId && (
            <div className="flex justify-end space-x-4">
              {/* 예약 상태 수정 버튼 */}
              <Button onClick={() => setOpenEditModal(true)} color="dark">
                수정
              </Button>
              {/* 예약 삭제 버튼 */}
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setOpenDeleteModal(true);
                }}>
                삭제
              </Button>
            </div>
          )}
          {/* 엑셀 내보내기 버튼 */}
          <Button
            onClick={setOpenExportModal}
            className="cursor-pointer"
            color="dark">
            <div className="flex flex-row gap-x-3 items-center">
              <FaFileExcel />
              <div className="break-keep">내보내기</div>
            </div>
          </Button>
        </div>
      </div>
      <div className="bg-white p-4 inline-block rounded-xl mb-8 shadow-md w-full">
        <Table>
          <Table.Head className="break-keep text-center">
            <Table.HeadCell className="bg-gray-200"></Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">출석 유무</Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">호실</Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">이름</Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">시작 시간</Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">종료 시간</Table.HeadCell>
          </Table.Head>
          <Table.Body className="divide-y text-center">
            {reservations
              ?.sort(
                (a, b) =>
                  new Date(a.reservationStartTime) -
                  new Date(b.reservationStartTime),
              )
              .map(reservation => (
                <Table.Row
                  className="cursor-pointer hover:bg-gray-50"
                  key={reservation.reservationId}>
                  <Table.Cell>
                    <Checkbox
                      className="rounded-none text-[#1D2430] focus:ring-[#1D2430]"
                      checked={
                        selectedReservationId === reservation.reservationId
                      }
                      onChange={() => {
                        setSelectedReservationId(prev =>
                          prev === reservation.reservationId
                            ? null
                            : reservation.reservationId,
                        );
                      }}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    {reservation.reservationState === 'VISITED' ? (
                      <div className="text-blue-600">출석</div>
                    ) : reservation.reservationState === 'NOT_VISITED' ? (
                      <div className="text-red-600">미출석</div>
                    ) : reservation.reservationState === 'PROCESSED' ? (
                      <div className="text-green-600">처리됨</div>
                    ) : (
                      '-'
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {reservation.roomName}-{reservation.partitionNumber}
                  </Table.Cell>
                  <Table.Cell
                    className="cursor-pointer hover:underline"
                    onClick={() =>
                      navigate(`/manage/fetchReservations/${reservation.userId}`)
                    }>
                    {reservation.name}
                  </Table.Cell>
                  <Table.Cell>
                    {format(
                      new Date(reservation.reservationStartTime),
                      'HH:mm',
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {format(new Date(reservation.reservationEndTime), 'HH:mm')}
                  </Table.Cell>
                </Table.Row>
              ))}
          </Table.Body>
        </Table>
        {/* pagination */}
        <div className="flex justify-center mt-4">
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(event, value) => setCurrentPage(value)}
            shape="rounded"
          />
        </div>
      </div>

      {/* 엑셀 내보내기 모달 */}
      <div className="flex justify-center items-center">
        <Modal
          show={openExportModal}
          onClose={() => setOpenExportModal(false)}
          className="flex justify-center items-center w-full p-4 sm:p-0">
          <Modal.Header>시작/종료 날짜 선택</Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-y-6">
              <div className="flex flex-row gap-x-3">
                {serviceRoles?.map(serviceRole => (
                  <div
                    key={serviceRole}
                    className="flex items-center gap-2 mb-2">
                    <Checkbox
                      className="rounded-none text-[#1D2430] focus:ring-[#1D2430]"
                      checked={selectedRoles.includes(serviceRole)}
                      onChange={() => toggleRole(serviceRole)}
                    />
                    <div>{serviceRole}</div>
                  </div>
                ))}
              </div>
              <DatePicker
                selectsRange
                startDate={startDate}
                endDate={endDate}
                onChange={dates => {
                  const [start, end] = dates;
                  setStartDate(start);
                  setEndDate(end);
                }}
                className="w-1/2"
                dateFormat="yyyy년 MM월 dd일"
                placeholderText="날짜를 선택하세요"
                withPortal
              />
            </div>
            <div className="flex justify-end">
              <Button
                color="dark"
                onClick={() => {
                  const params = {
                    states: selectedRoles,
                    startDateTime: startDate
                      ? toISODateUTC(startDate)
                      : undefined,
                    endDateTime: endDate ? toISODateUTC(endDate) : undefined,
                  };
                  useExportReservationExcel(params); // 엑셀 내보내기 API 호출
                  setOpenExportModal(false);
                }}>
                Export
              </Button>
            </div>
          </Modal.Body>
        </Modal>
      </div>

      {/* 예약 삭제 모달 */}
      <div className="flex justify-center items-center">
        <Modal
          className="flex justify-center items-center w-full p-4 sm:p-0"
          show={openDeleteModal}
          size="md"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClose={() => setOpenDeleteModal(false)}
          popup>
          <Modal.Header />
          <Modal.Body>
            <div className="text-center">
              <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
              <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                해당 예약을 삭제하시겠습니까?
              </h3>
              <div className="flex justify-center gap-4">
                <Button color="gray" onClick={() => setOpenDeleteModal(false)}>
                  취소
                </Button>
                <Button
                  color="failure"
                  onClick={() => {
                    handleDelete(selectedReservationId);
                    setOpenDeleteModal(null);
                  }}>
                  확인
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>

        {/* 출석 상태 변경 모달 */}
        <Modal
          show={openEditModal}
          onClose={() => setOpenEditModal(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Modal.Header className="pr-24">
            예약 상태 변경 유형 선택
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col space-y-6">
              <p
                className="inline-block text-lg hover:underline cursor-pointer"
                onClick={() => handleStateChange('VISITED')}>
                출석으로 변경
              </p>
              <p
                className="inline-block text-lg hover:underline cursor-pointer"
                onClick={() => handleStateChange('NOT_VISITED')}>
                미출석으로 변경
              </p>
              <p
                className="inline-block text-lg hover:underline cursor-pointer"
                onClick={() => handleStateChange('PROCESSED')}>
                처리됨으로 변경
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button color="gray" onClick={() => setOpenDeleteModal(false)}>
              취소
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
};

export default ReservationState;
