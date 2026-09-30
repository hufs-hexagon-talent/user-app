import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryClient } from '../queryClient';

// [관리자] RoomOperationPolicy 생성
// endsAtMidnight 는 선택 필드다. 보내지 않으면 서버가 꺼진 것으로 만든다.
export const useCreatePolicy = () => {
  return useMutation({
    mutationFn: async ({
      operationStartTime,
      operationEndTime,
      eachMaxMinute,
      endsAtMidnight,
    }) => {
      const createPolicy_res = await apiClient.post('/policies/policy', {
        operationStartTime,
        operationEndTime,
        eachMaxMinute,
        endsAtMidnight,
      });
      return createPolicy_res.data;
    },
  });
};

// [관리자] 모든 RoomOperationPolicy 조회
export const fetchAllPolicies = async () => {
  const all_policies_res = await apiClient.get('/policies');
  return all_policies_res.data.data.operationPolicyInfos;
};

export const useAllPolicies = () => {
  return useQuery({
    queryKey: ['allPolicies'],
    queryFn: fetchAllPolicies,
  });
};

// [관리자] RoomOperationPolicy 삭제
export const useDeletePolicy = () => {
  return useMutation({
    mutationFn: async policyId => {
      const deletePolicy_res = await apiClient.delete(`/policies/${policyId}`);
      return deletePolicy_res.data;
    },
  });
};

// [관리자] RoomOperationPolicy 조회
const fetchPolicy = async policyId => {
  const response = await apiClient.get(`/policies/${policyId}`);
  return response.data.data;
};

export const usePolicy = policyId => {
  return useQuery({
    queryKey: ['policy', policyId],
    queryFn: () => fetchPolicy(policyId),
    enabled: !!policyId,
  });
};

// [관리자] RoomOperationPolicy 정보 업데이트
// endsAtMidnight 를 보내지 않으면(undefined) 서버가 지금 값을 유지한다. true 는 켜고 false 는 끈다.
export const useEditPolicy = () => {
  return useMutation({
    mutationFn: async ({
      roomOperationPolicyId,
      operationStartTime,
      operationEndTime,
      eachMaxMinute,
      endsAtMidnight,
    }) => {
      const response = await apiClient.patch(
        `/policies/policy/${roomOperationPolicyId}`,
        {
          operationStartTime,
          operationEndTime,
          eachMaxMinute,
          endsAtMidnight,
        },
      );
      return response.data;
    },
    // 수정 판은 ['policy', id] 캐시로 연다. 저장 뒤 같은 정책을 다시 열었을 때 저장 전 값
    // (예: 켜기 전의 자정 운영 여부)이 보이지 않게 비운다.
    onSuccess: (_, { roomOperationPolicyId }) => {
      queryClient.invalidateQueries({
        queryKey: ['policy', roomOperationPolicyId],
      });
    },
  });
};
