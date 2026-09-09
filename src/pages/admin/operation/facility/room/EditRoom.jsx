import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Checkbox, Table, Modal } from 'flowbite-react';
import {
  usePartitionsByRoomId,
  useRooms,
  useAllRooms,
} from '../../../../../api/room.api';
import {
  useDeletePartition,
  useEditPartition,
} from '../../../../../api/roomPartition.api';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { Input } from '@mui/material';
import { useCustomSnackbars } from '../../../../../components/snackbar/SnackBar';

const EditRoom = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { data: allRooms } = useAllRooms();
  const { data: room } = useRooms(roomId);
  const { data: roomPartitions, refetch } = usePartitionsByRoomId(roomId);
  const { mutate: deletePartition } = useDeletePartition();
  const { mutate: editPartition } = useEditPartition();
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();

  const [selectedPartitionId, setSelectedPartitionId] = useState(null);
  const [editRoomId, setEditRoomId] = useState(null); // 드롭다운 선택용
  const [editPartitionNumber, setEditPartitionNumber] = useState(''); // input 입력용

  const [openEditModal, setOpenEditModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const departmentName = room?.departmentName;
  const roomName = room?.roomName;

  const handleCheckboxChange = partitionId => {
    setSelectedPartitionId(prev => (prev === partitionId ? null : partitionId));
  };

  // 파티션 삭제
  const handleDelete = () => {
    if (!selectedPartitionId) return;
    deletePartition(selectedPartitionId, {
      onSuccess: () => {
        setSelectedPartitionId(null); // 선택 초기화
        refetch();
      },
      // onError 가 없으면 서버가 ROOM-008 로 거절해도 화면에 아무 일도 일어나지 않아
      // 관리자는 지워진 줄 안다. 서버 원문 대신 상태로만 판정한다.
      onError: error => {
        openErrorSnackbar(
          error?.response?.status === 409
            ? '이 파티션에 예약 이력이 남아 있어 삭제할 수 없습니다.'
            : '파티션 삭제에 실패했습니다.',
          2500,
        );
      },
    });
  };

  // 파티션 수정
  const handleEdit = async () => {
    await editPartition(
      {
        partitionId: selectedPartitionId,
        roomId: editRoomId,
        partitionNumber: editPartitionNumber,
      },
      {
        onSuccess: () => {
          openSuccessSnackbar('파티션 수정 성공', 2500);
          refetch();
          setOpenEditModal(false);
          setSelectedPartitionId(null);
          setEditRoomId(null);
          setEditPartitionNumber(null);
        },
        onError: error => {
          openErrorSnackbar('파티션 수정 실패', 2500);
        },
      },
    );
  };

  useEffect(() => {
    if (
      openEditModal &&
      selectedPartitionId &&
      roomPartitions?.data?.partitions
    ) {
      const selectedPartition = roomPartitions.data.partitions.find(
        p => p.roomPartitionId === selectedPartitionId,
      );
      if (selectedPartition) {
        setEditRoomId(selectedPartition.roomId);
        setEditPartitionNumber(selectedPartition.partitionNumber.toString());
      }
    }
  }, [openEditModal, selectedPartitionId, roomPartitions]);

  console.log(allRooms);

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex justify-between items-center pt-4">
        <div>
          <div
            onClick={() => navigate('/manage/facility/room')}
            className="font-bold text-3xl text-black cursor-pointer">
            {roomName}호
          </div>
          <div className="px-4 text-sm text-gray-500">{departmentName}</div>
        </div>
        {selectedPartitionId && (
          <div className="flex space-x-2">
            <Button color="dark" onClick={() => setOpenEditModal(true)}>
              수정
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => setOpenDeleteModal(true)}>
              삭제
            </Button>
          </div>
        )}
      </div>

      <Table className="shadow-md">
        <Table.Head className="text-md break-keep">
          <Table.HeadCell className="bg-gray-200"></Table.HeadCell>
          <Table.HeadCell className="bg-gray-200">파티션ID</Table.HeadCell>
          <Table.HeadCell className="bg-gray-200">파티션명</Table.HeadCell>
        </Table.Head>
        <Table.Body className="bg-white">
          {roomPartitions?.data?.partitions?.map(roomPartition => (
            <Table.Row
              className="text-md hover:bg-gray-50"
              key={roomPartition.roomPartitionId}>
              <Table.Cell>
                <Checkbox
                  className="rounded-none text-[#1D2430] focus:ring-[#1D2430]"
                  checked={
                    selectedPartitionId === roomPartition.roomPartitionId
                  }
                  onChange={() =>
                    handleCheckboxChange(roomPartition.roomPartitionId)
                  }
                />
              </Table.Cell>
              <Table.Cell>{roomPartition.roomPartitionId}</Table.Cell>
              <Table.Cell>
                {roomPartition.roomName}-{roomPartition.partitionNumber}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {/* 파티션 수정 모달 */}
      <Modal show={openEditModal} onClose={() => setOpenEditModal(false)}>
        <Modal.Header>
          <strong>{selectedPartitionId}번</strong> 파티션 수정
        </Modal.Header>
        <Modal.Body>
          <Table>
            <Table.Head>
              <Table.HeadCell>파티션 ID</Table.HeadCell>
              <Table.HeadCell>호실 ID</Table.HeadCell>
              <Table.HeadCell>파티션 번호</Table.HeadCell>
            </Table.Head>

            <Table.Body>
              <Table.Row>
                {/* 파티션 ID (읽기 전용) */}
                <Table.Cell>{selectedPartitionId}</Table.Cell>

                {/* 호실 드롭다운 */}
                <Table.Cell>
                  <select
                    className="w-full border border-gray-300 rounded-md p-1"
                    value={editRoomId || ''}
                    onChange={e => setEditRoomId(Number(e.target.value))}>
                    <option value="" disabled>
                      호실 선택
                    </option>
                    {allRooms?.map(room => (
                      <option key={room.roomId} value={room.roomId}>
                        {room.roomName} (ID: {room.roomId})
                      </option>
                    ))}
                  </select>
                </Table.Cell>

                {/* 파티션 번호 입력 */}
                <Table.Cell>
                  <Input
                    type="text"
                    value={editPartitionNumber}
                    onChange={e => setEditPartitionNumber(e.target.value)}
                    placeholder="파티션 번호 입력"
                    fullWidth
                  />
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
          <div className="flex justify-end">
            <Button onClick={handleEdit} color="dark">
              수정
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* 삭제 모달 */}
      <div className="flex justify-center items-center">
        <Modal
          show={openDeleteModal}
          className="flex justify-center items-center"
          onClose={() => setOpenDeleteModal(false)}>
          <Modal.Body>
            <div className="text-center">
              <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
              <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                해당 파티션을 삭제하시겠습니까?
              </h3>
              <div className="flex justify-center gap-4">
                <Button color="gray" onClick={() => setOpenDeleteModal(false)}>
                  취소
                </Button>
                <Button
                  color="failure"
                  onClick={() => {
                    handleDelete(selectedPartitionId);
                    setOpenDeleteModal(null);
                  }}>
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

export default EditRoom;
