import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryClient } from '../queryClient';

// 자신의 예약 생성
export const useReserve = () => {
  return useMutation({
    mutationFn: async ({ roomPartitionId, startDateTime, endDateTime }) => {
      const res = await apiClient.post('/reservations', {
        roomPartitionId,
        startDateTime,
        endDateTime,
      });

      return res.data; // 명시적으로 반환
    },
    // 성공하면 내 칸이, 겹침(412)으로 실패하면 남이 먼저 잡은 칸이 표에 반영돼야 한다.
    // 내 예약·최근 예약 캐시도 같이 비운다 — 예약 직후 문의 폼의 예약 선택 목록과
    // 마이페이지의 현재 예약 배지가 마운트 재조회에만 기대면 캐시가 먼저 그려져 잠깐 빠진다.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reservationsByRooms'] });
      queryClient.invalidateQueries({ queryKey: ['userReservation'] });
      queryClient.invalidateQueries({ queryKey: ['latest'] });
    },
  });
};

// 특정 날짜, 특정 partition들 모든 예약 상태 확인 (1차원, checkVisit에 사용)
export const fetchReservationsByPartitions = async ({ date, partitionIds }) => {
  const params = new URLSearchParams();
  params.append('date', date);
  partitionIds.forEach(id => params.append('partitionIds', id));

  const response = await apiClient.get(
    `/reservations/partitions/by-date?${params.toString()}`,
  );
  return response.data.data.reservationInfoResponses;
};

export const useReservationsByPartitions = ({ date, partitionIds }) =>
  useQuery({
    queryKey: ['reservationsByPartitions', date, partitionIds],
    queryFn: () => fetchReservationsByPartitions({ date, partitionIds }),
  });

// 특정 날짜, 특정 부서가 관리하는 모든 파티션의 예약 상태 조회
export const fetchReservations = async ({ date, departmentId }) => {
  const url = `/reservations/by-date/${departmentId}?date=${date}`;
  const response = await apiClient.get(url);
  const data = response.data.data.partitionReservationInfos;

  return data;
};

export const useReservations = ({ date, departmentId }) =>
  useQuery({
    queryKey: ['reservationsByRooms', date, departmentId],
    queryFn: () => fetchReservations({ date, departmentId }),
    enabled: !!departmentId,
    // 표를 열어둔 사이 남이 잡거나 취소한 칸이 반영되지 않으면 제출 단계에서야 겹침을 알게 된다.
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

// 예약 삭제하기
export const useDeleteReservation = () => {
  return useMutation({
    mutationFn: async reservationId => {
      const res = await apiClient.delete(`/reservations/me/${reservationId}`);
      return res.data;
    },
    // 실패했을 때도 갱신해야 한다. 이미 사라진 예약이면 화면에 그대로 남아 재시도만 반복된다.
    onSettled: () => {
      // v5 는 객체 필터만 받는다. 문자열을 주면 전체 캐시가 무효화된다.
      // 삭제 후 갱신이 필요한 화면: 내 예약 목록, 체크인 대상, 노쇼 목록
      queryClient.invalidateQueries({ queryKey: ['userReservation'] });
      queryClient.invalidateQueries({ queryKey: ['latest'] });
      queryClient.invalidateQueries({ queryKey: ['noShow'] });
    },
  });
};

// 관리자 예약 삭제
export const useAdminDeleteReservation = () => {
  return useMutation({
    mutationFn: async reservationId => {
      const adminDelete_res = await apiClient.delete(
        `/reservations/admin/${reservationId}`,
      );
      return adminDelete_res.data;
    },
  });
};

export const fetchUserReservation = async () => {
  const user_reservation_response = await apiClient.get('/reservations/me');
  return user_reservation_response.data.data.reservationInfoResponses.reverse();
};

export const useUserReservation = () =>
  useQuery({
    queryKey: ['userReservation'],
    queryFn: fetchUserReservation,
  });

// 노쇼 횟수
const fetchNoShow = async () => {
  const noshow_res = await apiClient.get('/reservations/me/no-show');
  return noshow_res.data.data;
};

export const useNoShow = () => {
  return useQuery({
    queryKey: ['noShow'],
    queryFn: fetchNoShow,
  });
};

// [관리자] 특정 예약 상태 변경
export const useChangeState = () => {
  return useMutation({
    mutationFn: async ({ reservationId, state }) => {
      const response = await apiClient.patch(
        `/reservations/admin/${reservationId}`,
        {
          state: state,
        },
      );
      return response.data;
    },
  });
};

// [관리자] userId로 사용자의 예약들 조회
const fetchReservationsById = async userId => {
  const reservationById_res = await apiClient.get(
    `/reservations/admin/users/${userId}`,
  );
  return reservationById_res.data.data.reservationInfoResponses;
};

export const useReservationsById = userId => {
  return useQuery({
    queryKey: ['reservationsById'],
    queryFn: () => fetchReservationsById(userId),
  });
};

// 자신이 현재 체크인 해야하는 예약 조회
const fetchLatestReservation = async () => {
  const latest_res = await apiClient.get('/reservations/me/latest');
  return latest_res.data.data.reservationInfoResponses;
};

export const useLatestReservation = () => {
  return useQuery({
    queryKey: ['latest'],
    queryFn: () => fetchLatestReservation(),
  });
};

// [관리자] 금일 예약들 통계 조회
const fetchReservationStatics = async date => {
  const statics_res = await apiClient.get(
    `/reservations/admin/statics/by-date?date=${date}`,
  );
  return statics_res.data.data;
};

export const useReservationStatics = date => {
  return useQuery({
    queryKey: ['statics', date],
    queryFn: () => fetchReservationStatics(date),
  });
};

// [관리자] 예약 정보 Excel 내보내기
export const useExportReservationExcel = async ({
  states,
  startDateTime,
  endDateTime,
}) => {
  const params = new URLSearchParams();
  states.forEach(state => params.append('states', state));
  if (startDateTime) params.append('startDateTime', startDateTime);
  if (endDateTime) params.append('endDateTime', endDateTime);

  const reservationExcel = await apiClient.get(
    `/reservations/export/excel?${params.toString()}`,
    // 내보내기는 건수가 많으면 오래 걸린다. 공통 타임아웃(15초)으로는 끊긴다.
    { responseType: 'blob', timeout: 120000 },
  );

  const formatDateForFilename = iso => {
    if (!iso) return 'unknown';
    const date = new Date(iso);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  };

  const start = formatDateForFilename(startDateTime);
  const end = formatDateForFilename(endDateTime);
  const statePart = states.length > 0 ? states.join('&') : 'ALL';

  const fileName = `${start}-${end}_${statePart}-Reservations.xlsx`;

  // 파일 다운로드 처리
  const url = window.URL.createObjectURL(new Blob([reservationExcel.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// [관리자] 예약 검색 조회
export const useReservationSearch = () => {
  return useMutation({
    mutationFn: async ({
      username,
      serial,
      roomIds,
      roomPartitionIds,
      startDateTime,
      endDateTime,
      states,
      page,
      size = 10,
    }) => {
      const response = await apiClient.post('reservations/search', {
        username,
        serial,
        roomIds,
        roomPartitionIds,
        startDateTime,
        endDateTime,
        states,
        page,
        size,
      });
      return response.data;
    },
  });
};

// [관리자] 예약 상태 리스트 조회
const fetchStates = async () => {
  const response = await apiClient.get('/reservations/states');
  return response.data.data;
};

export const useStates = () => {
  return useQuery({
    queryKey: ['states'],
    queryFn: fetchStates,
  });
};
