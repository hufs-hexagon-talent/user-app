import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryClient } from '../queryClient';

// 내 문의 목록 조회
export const fetchMyInquiries = async () => {
  const response = await apiClient.get('/inquiries/me');
  return response.data.data.inquiryInfoResponses;
};

export const useMyInquiries = () =>
  useQuery({
    queryKey: ['inquiries', 'me'],
    queryFn: fetchMyInquiries,
  });

// 성공이든 실패든 목록을 다시 읽어야 화면이 실제 상태를 따라간다. 프로미스를 반환해야
// mutateAsync 가 재조회까지 기다린다 — 그래야 접수 직후 목록 화면이 stale 캐시를 먼저 그리지 않는다.
const invalidateMyInquiries = () =>
  queryClient.invalidateQueries({ queryKey: ['inquiries', 'me'] });

// 문의 접수
export const useCreateInquiry = () =>
  useMutation({
    mutationFn: async ({
      category,
      content,
      reservationId,
      roomId,
      occurredAt,
    }) => {
      const response = await apiClient.post('/inquiries', {
        category,
        content,
        reservationId,
        // 시설 문의만 값이 있다. 수정에서 roomId·occurredAt 는 교체(null = 지움), reservationId 는 유지다.
        roomId,
        occurredAt,
      });
      return response.data;
    },
    onSettled: invalidateMyInquiries,
  });

// 문의 수정 (OPEN 상태에서만 가능 — 서버가 INQUIRY-003 으로 막는다)
export const useUpdateInquiry = () =>
  useMutation({
    mutationFn: async ({
      inquiryId,
      category,
      content,
      reservationId,
      roomId,
      occurredAt,
    }) => {
      const response = await apiClient.patch(`/inquiries/me/${inquiryId}`, {
        category,
        content,
        reservationId,
        roomId,
        occurredAt,
      });
      return response.data;
    },
    onSettled: invalidateMyInquiries,
  });

// 문의 삭제
export const useDeleteInquiry = () =>
  useMutation({
    mutationFn: async inquiryId => {
      const response = await apiClient.delete(`/inquiries/me/${inquiryId}`);
      return response.data;
    },
    onSettled: invalidateMyInquiries,
  });
