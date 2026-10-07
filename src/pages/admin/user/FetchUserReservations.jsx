import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useReservationsById,
  useChangeState,
  useAdminDeleteReservation,
} from '../../../api/reservation.api';
import { useUserById } from '../../../api/user.api';
import { format } from 'date-fns';
import { Button, Checkbox, Table, Modal } from 'flowbite-react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { useCustomSnackbars } from '../../../components/snackbar/SnackBar';
import { endTimeLabel } from '../../../utils/reservationTimeLabel';
import { Pagination } from '@mui/material';

const FetchUserReservations = () => {
  const { id } = useParams();

  const { mutateAsync: changeState } = useChangeState();
  const { mutate: doDelete } = useAdminDeleteReservation();
  const { data: fetchedReservations, refetch } = useReservationsById(id);
  const { data: userById } = useUserById(id);

  const [openDeleteModal, setOpenDeleteModal] = useState(null);
  const [openEditModal, setOpenEditModal] = useState(null);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [error, setError] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();

  useEffect(() => {
    if (fetchedReservations) {
      setReservations(fetchedReservations);
    }
  }, [fetchedReservations]);

  // 예약 삭제
  const handleDelete = reservationId => {
    doDelete(reservationId, {
      onSuccess: () => {
        setReservations(prevReservations =>
          prevReservations.filter(
            reservation => reservation.reservationId !== reservationId,
          ),
        );
        openSuccessSnackbar('예약 삭제 성공', 3000);
      },
      onError: err => {
        setError('예약 삭제 실패');
        openErrorSnackbar(error);
        console.error(err);
      },
    });
  };

  // 예약 상태 수정
  const handleStateChange = async state => {
    try {
      const response = await changeState({
        reservationId: selectedReservationId,
        state,
      });
      openSuccessSnackbar(response.message, 2500);
      setOpenEditModal(false);

      await refetch();
    } catch (error) {
      openErrorSnackbar(error.response.data.errorMessage, 2500);
    }
  };

  // 현재 페이지의 예약 목록을 가져옴
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReservations = reservations
    ?.sort((a, b) => b.reservationId - a.reservationId)
    .slice(startIndex, startIndex + itemsPerPage);

  const pageCount = Math.ceil(reservations.length / itemsPerPage);

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-between items-center pt-8">
        <h1 className="text-3xl mx-4">
          <strong>{userById?.name}</strong>님의 예약
        </h1>

        {selectedReservationId && (
          <div className="flex justify-end space-x-4">
            <Button color="dark" onClick={() => setOpenEditModal(true)}>
              수정
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setOpenDeleteModal(true);
              }}>
              삭제
            </Button>
          </div>
        )}
      </div>
      <Table className="my-10">
        <Table.Head className="break-keep text-center">
          <Table.HeadCell className="bg-gray-200"></Table.HeadCell>
          <Table.HeadCell className="bg-gray-200">출석 상태</Table.HeadCell>
          <Table.HeadCell className="bg-gray-200">예약 ID</Table.HeadCell>
          <Table.HeadCell className="bg-gray-200">호실</Table.HeadCell>
          <Table.HeadCell className="bg-gray-200">날짜</Table.HeadCell>
          <Table.HeadCell className="bg-gray-200">시작 시간</Table.HeadCell>
          <Table.HeadCell className="bg-gray-200">종료 시간</Table.HeadCell>
        </Table.Head>
        <Table.Body className="divide-y text-center">
          {paginatedReservations
            ?.sort((a, b) => b.reservationId - a.reservationId)
            .map(reservation => (
              <Table.Row
                key={reservation.reservationId}
                className="bg-white cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                <Table.Cell>
                  <Checkbox
                    className="rounded-none text-[#1D2430] focus:ring-[#1D2430] cursor-pointer"
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
                <Table.Cell>{reservation.reservationState}</Table.Cell>
                <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                  {reservation.reservationId}
                </Table.Cell>
                <Table.Cell>
                  {reservation.roomName}-{reservation.partitionNumber}
                </Table.Cell>
                <Table.Cell>
                  {format(
                    new Date(reservation.reservationStartTime),
                    'yyyy-MM-dd',
                  )}
                </Table.Cell>
                <Table.Cell>
                  {format(new Date(reservation.reservationStartTime), 'HH:mm')}
                </Table.Cell>
                <Table.Cell>
                  {endTimeLabel(
                    reservation.reservationStartTime,
                    reservation.reservationEndTime,
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
        </Table.Body>
      </Table>

      <Pagination
        count={pageCount} // 총 페이지 개수
        page={currentPage} // 현재 페이지
        onChange={(event, value) => setCurrentPage(value)} // 페이지 변경 핸들러
        shape="rounded"
        className="flex justify-center py-8"
      />

      <div className="flex justify-center items-center">
        {/* 예약 삭제 모달 */}
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
            <Button color="gray" onClick={() => setOpenEditModal(false)}>
              취소
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
};

export default FetchUserReservations;
