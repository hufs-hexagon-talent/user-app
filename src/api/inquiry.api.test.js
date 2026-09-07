import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';

import { queryClient } from '../queryClient';

import { apiClient } from './client';
import {
  useCreateInquiry,
  useDeleteInquiry,
  useUpdateInquiry,
} from './inquiry.api';

jest.mock('./client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const flush = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

// 접수·수정·삭제 뒤 목록 화면으로 가는데, 재조회가 끝나기 전에 도착하면 stale 캐시(첫 문의면 0건)가
// 먼저 그려진다. mutateAsync 가 무효화(재조회)까지 기다려야 목록이 최신인 채로 도착한다.
describe.each([
  [
    'useCreateInquiry',
    useCreateInquiry,
    'post',
    { category: 'ETC', content: 'x', reservationId: null },
  ],
  [
    'useUpdateInquiry',
    useUpdateInquiry,
    'patch',
    { inquiryId: 1, category: 'ETC', content: 'x', reservationId: null },
  ],
  ['useDeleteInquiry', useDeleteInquiry, 'delete', 1],
])('%s', (_, useHook, method, arg) => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient[method].mockResolvedValue({ data: {} });
  });

  it('mutateAsync 는 내 문의 캐시 무효화가 끝난 뒤에 해소된다', async () => {
    let finishInvalidate;
    const invalidate = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(
        () =>
          new Promise(resolve => {
            finishInvalidate = resolve;
          }),
      );
    const { result } = renderHook(() => useHook(), { wrapper });

    let settled = false;
    let mutation;
    await act(async () => {
      mutation = result.current.mutateAsync(arg).then(() => {
        settled = true;
      });
    });
    await flush();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inquiries', 'me'] });
    expect(settled).toBe(false);

    await act(async () => {
      finishInvalidate();
      await mutation;
    });
    expect(settled).toBe(true);
    invalidate.mockRestore();
  });
});
