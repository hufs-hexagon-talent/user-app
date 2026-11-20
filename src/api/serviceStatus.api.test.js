import { vi } from 'vitest';
import { fetchServiceStatus } from './serviceStatus.api';

// 연결 진단(useConnectionDiagnosis)이 읽는 것은 counts 의 up, down, total 뿐이다.
const respond = (body, { ok = true, status = 200 } = {}) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
};
const monitor = id => ({
  monitorId: id,
  name: `monitor-${id}`,
  statusClass: 'success',
  '30dRatio': {
    ratio: '100.000',
  },
  dailyRatios: [
    {
      date: '2026-10-16',
      ratio: '100.000',
      color: 'green',
    },
  ],
});
describe('fetchServiceStatus', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  it('상태 페이지 집계에서 정상, 장애, 전체 수만 돌려준다', async () => {
    respond({
      status: 'ok',
      statistics: {
        counts: {
          up: 2,
          down: 1,
          paused: 0,
          total: 3,
        },
      },
      data: [monitor(1), monitor(2), monitor(3)],
    });
    await expect(fetchServiceStatus()).resolves.toEqual({
      counts: {
        up: 2,
        down: 1,
        total: 3,
      },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('stats.uptimerobot.com/api/getMonitorList/'),
      expect.objectContaining({
        credentials: 'omit',
      }),
    );
  });
  it('집계에 전체 수가 없으면 응답에 실린 모니터 수로 대신한다', async () => {
    respond({
      status: 'ok',
      statistics: {
        counts: {
          up: 2,
          down: 0,
        },
      },
      data: [monitor(1), monitor(2)],
    });
    await expect(fetchServiceStatus()).resolves.toEqual({
      counts: {
        up: 2,
        down: 0,
        total: 2,
      },
    });
  });
  it('집계도 모니터 목록도 없으면 0 으로 채운다', async () => {
    respond({
      status: 'ok',
    });
    await expect(fetchServiceStatus()).resolves.toEqual({
      counts: {
        up: 0,
        down: 0,
        total: 0,
      },
    });
  });

  // 모니터 목록의 원소는 읽지 않으므로, 목록이 배열이 아니거나 원소가 깨져 있어도 집계로 답한다.
  it('모니터 목록의 모양이 달라도 집계를 돌려준다', async () => {
    const counts = {
      up: 3,
      down: 0,
      total: 3,
    };
    respond({
      status: 'ok',
      statistics: {
        counts,
      },
      data: {},
    });
    await expect(fetchServiceStatus()).resolves.toEqual({
      counts,
    });
    respond({
      status: 'ok',
      statistics: {
        counts,
      },
      data: [null],
    });
    await expect(fetchServiceStatus()).resolves.toEqual({
      counts,
    });
    respond({
      status: 'ok',
      statistics: {
        counts,
      },
      data: [
        {
          monitorId: 1,
          dailyRatios: 'x',
        },
      ],
    });
    await expect(fetchServiceStatus()).resolves.toEqual({
      counts,
    });
  });
  it('정상 응답이 아니면 던진다', async () => {
    respond({
      status: 'fail',
    });
    await expect(fetchServiceStatus()).rejects.toThrow();
    respond(
      {},
      {
        ok: false,
        status: 503,
      },
    );
    await expect(fetchServiceStatus()).rejects.toThrow('503');
  });
});
