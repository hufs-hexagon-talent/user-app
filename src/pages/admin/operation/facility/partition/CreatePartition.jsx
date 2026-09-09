import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCreatePartition,
  useAllPartitions,
} from '../../../../../api/roomPartition.api';
import { useAllRooms } from '../../../../../api/room.api';
import { Input } from '@mui/material';
import { useCustomSnackbars } from '../../../../../components/snackbar/SnackBar';
import Create from '../../../../../assets/icons/create.png';
import { Table } from 'flowbite-react';

const CreatePartition = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState(null);
  const [partitionNumber, setPartitionNumber] = useState(null);
  const { data: partitions, refetch } = useAllPartitions();
  const { data: rooms } = useAllRooms();
  const { mutateAsync: doCreatePartition } = useCreatePartition();

  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();

  const groupedPartitions = partitions?.reduce((acc, cur) => {
    const key = cur.roomName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(`${cur.roomName}-${cur.partitionNumber}`);
    return acc;
  }, {});

  // 파티션 생성
  const createPartition = async () => {
    try {
      const response = await doCreatePartition({ roomId, partitionNumber });
      await refetch();
      openSuccessSnackbar(response?.message, 3000);
    } catch (error) {
      openErrorSnackbar(error.response.data.message, 3000);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Partition */}
      <div className="font-bold text-3xl mt-10 mb-6">Partition</div>
      {/* 파티션 생성 */}
      <div className="bg-white  xl:w-1/2 p-4 mb-8 inline-block shadow-md rounded-xl w-full">
        <div className="flex flex-row items-center gap-x-6">
          <div className="font-bold text-xl p-3">Partition 생성</div>
          {/* Partition 생성 버튼 */}
          <img
            src={Create}
            onClick={createPartition}
            className="cursor-pointer hover:scale-125 w-6 h-6"
          />
        </div>
        {/* RoomId */}
        <div className="flex flex-row items-center p-3">
          <div>호실 ID : </div>
          <Input
            onChange={e => setRoomId(e.target.value)}
            value={roomId}
            type="number"
            className="rounded mx-2"
          />
        </div>
        {/* PartitionNumber */}
        <div className="flex flex-row items-center p-3">
          <div>파티션 번호 : </div>
          <Input
            onChange={e => setPartitionNumber(e.target.value)}
            value={partitionNumber}
            type="number"
            className="rounded mx-2"
          />
        </div>
      </div>
      {/* 파티션 조회 */}
      <div className="bg-white xl:w-1/2  p-4 mb-8 inline-block shadow-md rounded-xl w-full">
        <div className="font-bold text-xl p-3">Partition 조회</div>
        <div>
          <Table className="text-md">
            <Table.Head className="text-md">
              <Table.HeadCell className="bg-gray-200">호실명</Table.HeadCell>
              <Table.HeadCell className="bg-gray-200">파티션명</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {groupedPartitions &&
                Object.entries(groupedPartitions).map(
                  ([roomName, partitionList]) => {
                    const matchedRoom = rooms?.find(
                      room => room.roomName === roomName,
                    );
                    const matchedRoomId = matchedRoom?.roomId;

                    return (
                      <Table.Row
                        onClick={() => {
                          navigate(`/manage/facility/room/${matchedRoomId}`);
                        }}
                        key={roomName}
                        className="cursor-pointer hover:bg-gray-50">
                        <Table.Cell>{roomName}</Table.Cell>
                        <Table.Cell>{partitionList.join(', ')}</Table.Cell>
                      </Table.Row>
                    );
                  },
                )}
            </Table.Body>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default CreatePartition;
