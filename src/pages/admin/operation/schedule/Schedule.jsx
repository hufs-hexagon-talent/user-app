import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useScheduleByDate,
  useSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
} from '../../../../api/policySchedule.api';
import { useAllRooms } from '../../../../api/room.api';
import { useAllPolicies } from '../../../../api/roomOperationPolicy.api';
import { Table, Checkbox, Modal, Button } from 'flowbite-react';
import { useCustomSnackbars } from '../../../../components/snackbar/SnackBar';
import { HiOutlineExclamationCircle } from 'react-icons/hi';

const Schedule = () => {
  const navigate = useNavigate();
  const { date } = useParams();
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const { data: scheduleByDate, refetch: refetchScheduleByDate } =
    useScheduleByDate(date);
  const { data: scheduleById } = useSchedule(selectedScheduleId);
  const { data: rooms } = useAllRooms();
  const { data: policies } = useAllPolicies();
  const { mutateAsync: updateSchedule } = useUpdateSchedule();
  const { mutateAsync: deleteSchedule } = useDeleteSchedule();
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();

  // scheduleById가 바뀔 때 초기화
  useEffect(() => {
    if (scheduleById) {
      setSelectedRoomId(scheduleById.roomId);
      setSelectedPolicyId(scheduleById.roomOperationPolicyId);
    }
  }, [scheduleById]);

  // 스케줄 수정
  const handleEditSchedule = async () => {
    try {
      await updateSchedule({
        roomOperationPolicyScheduleId: selectedScheduleId,
        roomId: selectedRoomId,
        roomOperationPolicyId: selectedPolicyId,
        policyApplicationDate: date,
      });

      openSuccessSnackbar('스케줄이 수정되었습니다.');
      await refetchScheduleByDate();
      setOpenEditModal(false);
    } catch (error) {
      openErrorSnackbar('스케줄 수정에 실패했습니다.');
    }
  };

  // 스케줄 삭제
  const handleDeleteSchedule = async () => {
    try {
      const response = await deleteSchedule(selectedScheduleId);
      openSuccessSnackbar(response?.message);
      await refetchScheduleByDate();
    } catch (error) {
      openErrorSnackbar('스케줄 삭제에 실패하였습니다.');
    }
  };

  return (
    <div>
      <div className="flex">
        <p
          onClick={() => navigate(`/manage/schedule/fetch`)}
          className="text-gray-500 cursor-pointer">
          스케줄 조회 &gt;{' '}
        </p>
        <p className="text-gray-500 pl-2 cursor-pointer">{date}</p>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-3xl py-6 px-4">
          <strong>{date}</strong>의 스케줄 상세 정보
        </div>
        {selectedScheduleId && (
          <div className="flex space-x-2">
            <Button
              onClick={() => setOpenEditModal(selectedScheduleId)}
              color="dark">
              수정
            </Button>
            <Button
              onClick={() => setOpenDeleteModal(selectedScheduleId)}
              className="bg-red-600 hover:bg-red-700">
              삭제
            </Button>
          </div>
        )}
      </div>
      <div>
        <Table>
          <Table.Head className="text-center">
            <Table.HeadCell className="bg-gray-200 text-lg"></Table.HeadCell>
            <Table.HeadCell className="bg-gray-200 text-lg">
              스케줄 ID
            </Table.HeadCell>
            <Table.HeadCell className="bg-gray-200 text-lg">
              호실 ID
            </Table.HeadCell>
            <Table.HeadCell className="bg-gray-200 text-lg">
              호실명
            </Table.HeadCell>
            <Table.HeadCell className="bg-gray-200 text-lg">
              정책 ID
            </Table.HeadCell>
            <Table.HeadCell className="bg-gray-200 text-lg">
              시작 시각
            </Table.HeadCell>
            <Table.HeadCell className="bg-gray-200 text-lg">
              종료 시각
            </Table.HeadCell>
            <Table.HeadCell className="bg-gray-200 text-lg">
              최대 이용 시간
            </Table.HeadCell>
          </Table.Head>
          <Table.Body className="bg-white text-center">
            {scheduleByDate?.map(schedule => (
              <Table.Row
                key={schedule.scheduleId}
                className="cursor-pointer hover:bg-gray-50">
                <Table.Cell>
                  <Checkbox
                    onChange={() => {
                      const nextId =
                        selectedScheduleId === schedule.scheduleId
                          ? null
                          : schedule.scheduleId;
                      setSelectedScheduleId(nextId);
                    }}
                    className="rounded-none text-[#1D2430] focus:ring-[#1D2430] cursor-pointer"
                  />
                </Table.Cell>
                <Table.Cell className="text-lg">
                  {schedule.scheduleId}
                </Table.Cell>
                <Table.Cell className="text-lg">{schedule.roomId}</Table.Cell>
                <Table.Cell className="text-lg">{schedule.roomName}</Table.Cell>
                <Table.Cell className="text-lg">{schedule.policyId}</Table.Cell>
                <Table.Cell className="text-lg">
                  {schedule.operationStartTime}
                </Table.Cell>
                <Table.Cell className="text-lg">
                  {schedule.operationEndTime}
                </Table.Cell>
                <Table.Cell className="text-lg">
                  {schedule.eachMaxMinute}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      {/* 스케줄 수정 모달 */}
      <Modal show={openEditModal} onClose={() => setOpenEditModal(false)}>
        <Modal.Header>스케줄 수정</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <Table>
              <Table.Head>
                <Table.HeadCell>스케줄 ID</Table.HeadCell>
                <Table.HeadCell>호실 ID</Table.HeadCell>
                <Table.HeadCell>정책 ID</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                <Table.Row className="cursor-pointer bg-white">
                  {/* 스케줄 ID */}
                  <Table.Cell>
                    {scheduleById?.roomOperationPolicyScheduleId}
                  </Table.Cell>

                  {/* 호실 드롭다운 */}
                  <Table.Cell>
                    <select
                      className="w-full border border-gray-300 rounded-md p-1"
                      value={selectedRoomId}
                      onChange={e => setSelectedRoomId(Number(e.target.value))}>
                      <option value="" disabled>
                        호실 선택
                      </option>
                      {rooms?.map(room => (
                        <option key={room.roomId} value={room.roomId}>
                          {room.roomName} (ID: {room.roomId})
                        </option>
                      ))}
                    </select>
                  </Table.Cell>

                  {/* 정책 드롭다운 */}
                  <Table.Cell>
                    <select
                      className="w-full border border-gray-300 rounded-md p-1"
                      value={selectedPolicyId}
                      onChange={e =>
                        setSelectedPolicyId(Number(e.target.value))
                      }>
                      <option value="" disabled>
                        정책 선택
                      </option>
                      {policies?.map(policy => (
                        <option
                          key={policy.roomOperationPolicyId}
                          value={policy.roomOperationPolicyId}>
                          정책 {policy.roomOperationPolicyId} (
                          {policy.operationStartTime} -{' '}
                          {policy.operationEndTime})
                        </option>
                      ))}
                    </select>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
            <div className="flex justify-end">
              <Button onClick={handleEditSchedule} color="dark">
                수정
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>

      {/* 스케줄 삭제 모달 */}
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
                  handleDeleteSchedule(selectedScheduleId);
                  setOpenDeleteModal(null);
                }}>
                확인
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Schedule;
