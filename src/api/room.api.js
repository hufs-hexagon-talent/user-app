import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

// [관리자] room 생성
export const useCreateRoom = () => {
  return useMutation({
    mutationFn: async ({ roomName, departmentId }) => {
      const createRoom_res = await apiClient.post('/rooms/room', {
        roomName,
        departmentId,
      });
      return createRoom_res.data;
    },
  });
};

// room 조회
export const fetchRoom = async roomId => {
  const room_response = await apiClient.get(`/rooms/${roomId}`);
  return room_response.data.data;
};

export const useRooms = roomId =>
  useQuery({
    queryKey: ['rooms', roomId],
    queryFn: () => fetchRoom(roomId),
    enabled: roomId !== null && roomId !== undefined,
  });

// [관리자] room 삭제
export const useDeleteRoom = () => {
  return useMutation({
    mutationFn: async ({ roomId }) => {
      const deleteRoom_res = await apiClient.delete(`/rooms/${roomId}`);
      return deleteRoom_res.data;
    },
  });
};

// 모든 room 조회
export const fetchAllRooms = async () => {
  const all_rooms_response = await apiClient.get('/rooms');
  return all_rooms_response.data.data.rooms;
};

export const useAllRooms = () => {
  return useQuery({
    queryKey: ['allRooms'],
    queryFn: fetchAllRooms,
  });
};

// 학생 앱은 부서를 하나로 고정한다(RoomPage.jsx 의 departmentId = 1 과 같은 값).
export const STUDENT_DEPARTMENT_ID = 1;

// 문의 폼(시설 문의)의 방 목록. useAllRooms 는 관리자 화면 7곳이 ['allRooms'] 키를 공유해 옵션을
// 못 건드리므로 전용 키를 쓴다. 방은 거의 바뀌지 않아 10분간 재조회하지 않고, 시설 유형을 고를 때만 부른다.
export const useInquiryRooms = ({ enabled }) =>
  useQuery({
    queryKey: ['inquiryRooms'],
    queryFn: async () =>
      (await fetchAllRooms()).filter(
        room => room.departmentId === STUDENT_DEPARTMENT_ID,
      ),
    enabled,
    staleTime: 10 * 60 * 1000,
  });

// [관리자] roomID로 partition들 조회
const fetchPartitionsByRoomId = async roomId => {
  const partitionsByRoomId_res = await apiClient.get(`/rooms/rooms/${roomId}`);
  return partitionsByRoomId_res.data;
};

export const usePartitionsByRoomId = roomId => {
  return useQuery({
    queryKey: ['roomId', roomId],
    queryFn: () => fetchPartitionsByRoomId(roomId),
    enabled: !!roomId,
  });
};

// [관리자] room 정보 수정
export const useEditRoom = () => {
  return useMutation({
    mutationFn: async ({ roomId, roomName, departmentId }) => {
      const response = await apiClient.patch(`/rooms/${roomId}`, {
        roomName,
        departmentId,
      });
      return response.data;
    },
  });
};
